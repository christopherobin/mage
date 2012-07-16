var mithril = require('../../mithril'),
    webbuilder = require('./webbuilder'),	// included to allow it to self-register contexts and builder
    contexts = require('../contexts'),
    builders = require('../builders'),
    BuildTarget = require('../buildTarget').BuildTarget,
    Manifest = require('./manifest').Manifest,
    zlib = require('zlib'),
    async = require('async'),
    logger = mithril.core.logger;


var DEFAULT_CLIENT_CONFIG = {
	language: 'en',
	density: 1,
	screen: [1, 1]
};


function makeClientConfig(language, density, screen) {
	var obj = {
		language: language && language.toLowerCase() || DEFAULT_CLIENT_CONFIG.language,
		density:  Number(density || DEFAULT_CLIENT_CONFIG.density)
	};

	if (Object.prototype.toString.call(screen).slice(8, -1) === 'String') {
		screen = screen.split(/[x,]/).map(Number);
	}

	if (Array.isArray(screen)) {
		// Ensures [short edge, long edge] order
		obj.screen = screen.sort();
	} else {
		obj.screen = DEFAULT_CLIENT_CONFIG.screen;
	}

	if (typeof obj.density !== 'number') {
		logger.error('Bad density');
		return null;
	}

	if (obj.screen.length !== 2 || typeof obj.screen[0] !== 'number' || typeof obj.screen[1] !== 'number') {
		logger.error('Bad screen');
		return null;
	}

	obj._key = obj.language + '-' + obj.density + '-' + obj.screen.join('x');
	return obj;
}


function WebApp(name, options) {
	// options: languages: ['en', 'ja'], densities: [1, 2], screens: [[320, 480], [768, 1024]]

	options = options || {};

	if (!options.languages || options.languages.length === 0) {
		options.languages = [DEFAULT_CLIENT_CONFIG.language];
	}

	if (!options.densities || options.densities.length === 0) {
		options.densities = [DEFAULT_CLIENT_CONFIG.density];
	}

	if (!options.screens || options.screens.length === 0) {
		options.screens = [DEFAULT_CLIENT_CONFIG.screen];
	}

	this.delivery = mithril.core.config.get('apps.' + name + '.delivery') || {};

	this.name = name;

	this.languages = options.languages.map(function (lang) {
		return lang.toLowerCase();
	});

	this.densities = options.densities;

	this.screens = options.screens.map(function (screen) {
		screen.sort();
		return screen;
	});

	this.clientConfigs = [];
	var self = this;

	self.densities.forEach(function (density) {
		self.languages.forEach(function (language) {
			self.screens.forEach(function (screen) {
				var config = makeClientConfig(language, density, screen);
				logger.debug('Added new supported client config for app "' + name + '":', config);
				self.clientConfigs.push(config);
			});
		});
	});

	this.route = '/app/' + name;

	this.buildTargets = [];
	this.pages = {};
	this.manifest = null;

	// create a single command center for this app

	this.commandCenter = new mithril.core.cmd.CommandCenter(this);

	this.firewall = null;	// Make this a function that receives a net.Socket. Returns a boolean that indicates if the client is allowed or not.

	mithril.core.app.register(name, this);
}


exports.WebApp = WebApp;


WebApp.prototype.addBuildTarget = function (buildTarget) {
	// internal usage

	this.buildTargets.push(buildTarget);
};


WebApp.prototype.setIndexPage = function (path, options) {
	return this.addIndexPage('index', path, options);
};


WebApp.prototype.addIndexPage = function (name, path, options) {
	options = options || {};

	var routes = [];
	var context = contexts.get('html');

	if (options.route) {
		// create a special route

		routes.push(this.route + '/' + options.route);
	} else if (options.routes) {
		// create many special routes

		for (var i = 0, len = options.routes.length; i < len; i++) {
			routes.push(this.route + '/' + options.routes[i]);
		}
	} else {
		// no special routes, so we make it the app route

		routes.push(this.route);
	}

	var page = new BuildTarget(this, 'dir', path, context, routes, options, true);

	this.pages[name] = page;
	this.addBuildTarget(page);

	return page;
};


WebApp.prototype.addPage = function (name, path, options) {
	options = options || {};

	options.path = path;

	var context = contexts.get('mithrilpage');
	var route = '/app/' + this.name + '/' + name;

	var page = new BuildTarget(this, 'web', name, context, [route], options, true);

	this.pages[name] = page;
	this.addBuildTarget(page);

	return page;
};


WebApp.prototype.getPage = function (name) {
	return this.pages[name] || null;
};


WebApp.prototype.createManifest = function (assetMap, options) {
	if (this.manifest) {
		logger.error('Manifest already defined for this application.');
		return null;
	}

	var manifest = new Manifest(assetMap);

	if (this.delivery.useManifest) {
		var context = contexts.get('manifest');
		var routes = ['/app/' + this.name + '/app.manifest'];

		options = options || {};
		options.manifest = manifest;

		var buildTarget = new BuildTarget(this, 'web', 'manifest', context, routes, options, true);

		this.manifest = buildTarget;
		this.addBuildTarget(buildTarget);
	} else {
		logger.info('HTML5 Application cache disabled, skipping build.');
	}

	return manifest;
};


WebApp.prototype.getManifestBuildTarget = function () {
	return this.manifest;
};


WebApp.prototype.addBuilder = function (key, fn) {
	this.builders[key] = fn;
};


// Get the best supported config based on what the client provides.
function getBestConfig(buildTarget, clientConfig) {
	var configs = buildTarget.app.clientConfigs,
		numConfigs = configs.length >>> 0,
		best = null,
		bestScreen = [-1, -1];

	if (typeof clientConfig === 'object' && clientConfig !== null) {
		while (numConfigs > 0) {
			var candidate = configs[--numConfigs];

			if (candidate.language !== clientConfig.language || candidate.density !== clientConfig.density ||
				candidate.screen > clientConfig.screen || candidate.screen < bestScreen) {
				// TODO: how can comparing screens like this ever work? they're arrays
				continue;
			}

			best = candidate;
			bestScreen = candidate.screen;
		}
	}

	return best;
}


// serveBuildTarget creates an HTTP response for the given buildTarget, and returns a hash to describe it

function serveBuildTarget(buildTarget, clientConfig, cb) {
	buildTarget.build(clientConfig, function (error, data, meta) {
		if (error) {
			return cb(error);
		}

		var hash = meta ? meta.hash : null;
		var headers = {};

		// set the proper mimetype

		headers['Content-type'] = buildTarget.context.mimetype;

		// uncompressed response

		if (!buildTarget.app.delivery.compress) {
			logger.info('Build target', buildTarget.describe(), 'size:', data.length, 'bytes.');
			cb(null, headers, data, hash);
			return;
		}

		// gzip compress contents

		logger.info('Build target', buildTarget.describe(), 'size before gzip compression:', data.length, 'bytes.');

		var gzip = zlib.createGzip({ level: 9 }), buffers = [], nread = 0;

		gzip.on('error', function (err) {
			gzip.removeAllListeners('end');
			gzip.removeAllListeners('error');

			logger.error('Gzip compression failed, serving uncompressed file.');

			cb(null, headers, data, hash);
		});

		gzip.on('data', function (chunk) {
			buffers.push(chunk);
			nread += chunk.length;
		});

		gzip.on('end', function () {
			var compressed = Buffer.concat(buffers, nread);

			logger.info('Build target', buildTarget.describe(), 'size after gzip compression:', compressed.length, 'bytes.');

			headers['Content-Encoding'] = 'gzip';

			cb(null, headers, compressed, hash);
		});

		gzip.end(data);
	});
}


function prebuildHttpResponses(buildTarget, cb) {
	// responses: { "en-1,2-480x960": { headers: {}, data: buff, hash: 'abc' }, "ja-1,1.5-400x640": { headers: {}, data: buff, hash: 'abc' }, etc... }

	// note: the buildTarget is the page

	var app = buildTarget.app;

	var responses = {};

	async.forEachSeries(
		app.clientConfigs,
		function (clientConfig, callback) {
			serveBuildTarget(buildTarget, clientConfig, function (error, headers, data, hash) {
				if (error) {
					return callback(error);
				}

				// register the response on the client config

				responses[clientConfig._key] = { headers: headers, data: data, hash: hash };

				callback();
			});
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, responses);
			}
		}
	);
}


function createCachedResponseHandler(app, buildTarget, responses) {
	return function cachedResponseHandler(req, path, params, cb) {
		// check if this client is allowed to do this request

		if (app.firewall && !app.firewall(req.connection, req)) {
			return cb(401);   // 401, unauthorized
		}

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));
		if (clientConfig === null) {
			return cb(500);
		}

		var response = responses[clientConfig._key];
		if (response) {
			if (response.hash && response.hash === params.hash) {
				cb(200, 'usecache', { 'Content-type': 'text/plain; charset=utf8' });
			} else {
				cb(200, response.data, response.headers);
			}
		} else {
			cb(404);
		}
	};
}


function createRealTimeBuildResponseHandler(app, buildTarget) {
	return function realTimeBuildResponseHandler(req, path, params, cb) {
		// check if this client is allowed to do this request

		if (app.firewall && !app.firewall(req.connection, req)) {
			return cb(401);   // 401, unauthorized
		}

		// cb: function (httpCode, [out buffer or string, headers])

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));
		if (clientConfig === null) {
			return cb(500);
		}

		serveBuildTarget(buildTarget, clientConfig, function (error, headers, data) {
			if (error) {
				cb(404);
			} else {
				cb(200, data, headers);
			}
		});
	};
}


WebApp.prototype.expose = function (cb) {
	logger.info('Exposing application "' + this.name + '" on HTTP server.');

	// registers routes in the http server in order to serve pages

	var httpServer = mithril.core.msgServer.getHttpServer();
	if (!httpServer) {
		logger.error('Cannot expose web app', this.name, ', because there is no HTTP server available.');
		return cb('noHttpServer');
	}

	// generate array of buildTargets

	var buildTargets = [];

	for (var name in this.buildTargets) {
		buildTargets.push(this.buildTargets[name]);
	}

	// expose each buildTarget

	var app = this;

	async.forEachSeries(
		buildTargets,
		function (buildTarget, callback) {
			logger.info('Exposing build target:', buildTarget.describe());

			if (app.delivery.serverCache) {
				// if we have server cache, we pre-build the build target in each client config and register a route to it

				prebuildHttpResponses(buildTarget, function (error, responses) {
					if (error) {
						return callback(error);
					}

					var handler = createCachedResponseHandler(app, buildTarget, responses);

					buildTarget.routes.forEach(function (route) {
						logger.debug('Registering route:', route);

						httpServer.addRoute(route, handler);
					});

					callback();
				});
			} else {
				// we do not use cache, so we register a route to the http handler that builds the buildTarget

				var handler = createRealTimeBuildResponseHandler(app, buildTarget);

				buildTarget.routes.forEach(function (route) {
					logger.debug('Registering route:', route);

					httpServer.addRoute(route, handler);
				});

				callback();
			}
		},
		cb
	);
};

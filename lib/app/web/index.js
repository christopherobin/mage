var mithril = require('../../mithril'),
	webbuilder = require('./webbuilder'),	// included to allow it to self-register contexts and builder
	contexts = require('../contexts'),
	builders = require('../builders'),
	BuildTarget = require('../buildTarget').BuildTarget,
	Manifest = require('./manifest').Manifest,
	zlib = require('zlib'),
	async = require('async');


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

	if (screen instanceof Array) {
		// Ensures [short edge, long edge] order
		obj.screen = screen.sort();
	} else {
		obj.screen = DEFAULT_CLIENT_CONFIG.screen;
	}

	if (isNaN(obj.density)) {
		mithril.core.logger.error('Bad density');
		return null;
	}

	if (obj.screen.length !== 2 ||
		isNaN(obj.screen[0]) ||
		isNaN(obj.screen[1])
	) {
		mithril.core.logger.error('Bad screen');
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
		return screen.sort();
	});

	this.clientConfigs = [];
	var self = this;
	self.densities.forEach(function (density) {
		self.languages.forEach(function (language) {
			self.screens.forEach(function (screen) {
				var config = makeClientConfig(language, density, screen);
				mithril.core.logger.debug('Added new supported client config for app "' + name + '": ' + JSON.stringify(config));
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
	this.addIndexPage('index', path, options);
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
};


WebApp.prototype.addPage = function (name, path, options) {
	options = options || {};

	options.path = path;

	var context = contexts.get('mithrilpage');
	var route = '/app/' + this.name + '/' + name;

	var page = new BuildTarget(this, 'web', name, context, [route], options, true);

	this.pages[name] = page;
	this.addBuildTarget(page);
};


WebApp.prototype.getPage = function (name) {
	return this.pages[name] || null;
};


WebApp.prototype.createManifest = function (assetMap, options) {
	if (this.manifest) {
		mithril.core.logger.error('Manifest already defined for this application.');
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
		mithril.core.logger.info('HTML5 Application cache disabled, skipping build.');
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
	if (Object.prototype.toString.call(clientConfig).slice(8, -1) === 'Object') {
		while (numConfigs > 0) {
			var candidate = configs[--numConfigs];
			if (
				candidate.language !== clientConfig.language ||
				candidate.density !== clientConfig.density ||
				candidate.screen > clientConfig.screen ||
				candidate.screen < bestScreen
			) {
				continue;
			}
			best = candidate;
			bestScreen = candidate.screen;
		}
	}
	return best;
}

function serveBuildTarget(buildTarget, clientConfig, cb) {
	// serveBuildTarget creates an HTTP response for the given buildTarget, and returns a hash to describe it
	buildTarget.build(clientConfig, function (error, data, meta) {
		if (error) {
			return cb(error);
		}

		var headers = {};
		headers['Content-type'] = buildTarget.context.mimetype;

		// gzip compress contents

		if (buildTarget.app.delivery.compress) {
			mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size before gzip compression: ' + data.length + ' bytes.');
			// TODO: when we support streaming, we can just compress things with:
			//       inputStream.pipe(gzip).pipe(outputStream);
			var callback = function (error, compressed) {
				if (error || !compressed) {
					mithril.core.logger.error('Gzip compression failed, serving uncompressed file.');
					return cb(null, headers, data, meta && meta.hash);
				}

				mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size after gzip compression: ' + compressed.length + ' bytes.');

				headers['Content-Encoding'] = 'gzip';
				cb(null, headers, compressed, meta && meta.hash);
			};

			var gzip = zlib.createGzip({level: 9}),
				buffers = [],
				nread = 0;

			gzip.on('error', function (err) {
				gzip.removeAllListeners('end');
				gzip.removeAllListeners('error');
				callback(err);
			});

			gzip.on('data', function (chunk) {
				buffers.push(chunk);
				nread += chunk.length;
			});

			gzip.on('end', function () {
				callback(null, Buffer.concat(buffers, nread));
			});

			gzip.end(data);
		} else {
			mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size: ' + data.length + ' bytes.');
			cb(null, headers, data, meta && meta.hash);
		}
	});
}


function handleHttpRequest(buildTarget, params, cb) {
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
}


function sendCachedResponse(buildTarget, params, responses, cb) {
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
}


function prebuildHttpResponses(buildTarget, cb) {
	// responses: { "en-1,2-480x960": { headers: {}, data: buff, hash: 'abc' }, "ja-1,1.5-400x640": { headers: {}, data: buff, hash: 'abc' }, etc... }

	var clientConfigs = buildTarget.app.clientConfigs;
	var responses = {};

	async.forEachSeries(
		clientConfigs,
		function (clientConfig, callback) {
			serveBuildTarget(buildTarget, clientConfig, function (error, headers, data, hash) {
				if (error) {
					callback(error);
				} else {
					// register the response on the client config

					responses[clientConfig._key] = { headers: headers, data: data, hash: hash };

					callback();
				}
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


WebApp.prototype.expose = function (cb) {
	mithril.core.logger.info('Exposing application "' + this.name + '" on HTTP server.');

	// registers routes in the http server in order to serve pages

	var httpServer = mithril.core.msgServer.getHttpServer();
	if (!httpServer) {
		mithril.core.logger.error('Cannot expose web app', this.name, ', because there is no HTTP server available.');
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
			mithril.core.logger.info('Exposing build target:', buildTarget.describe());

			if (app.delivery.serverCache) {
				// if we have server cache, we pre-build the build target in each client config and register a route to it

				prebuildHttpResponses(buildTarget, function (error, responses) {
					if (error) {
						return callback(error);
					}

					buildTarget.routes.forEach(function (route) {
						// responses: { EN: { headers: {}, data: buff, hash: 'abc' }, JA: { headers: {}, data: buff, hash: 'abc' }, etc... }

						httpServer.addRoute(route, function (req, path, params, cb) {
							// check if this client is allowed to do this request

							if (app.firewall && !app.firewall(req.connection, req)) {
								return cb(401);   // 401, unauthorized
							}

							sendCachedResponse(buildTarget, params, responses, cb);
						});
					});

					callback();
				});
			} else {
				// we do not use cache, so we register a route to the http handler that builds the buildTarget

				buildTarget.routes.forEach(function (route) {
					mithril.core.logger.debug('Registering dynamic build target route:', route);

					httpServer.addRoute(route, function (req, path, params, cb) {
						// check if this client is allowed to do this request

						if (app.firewall && !app.firewall(req.connection, req)) {
							return cb(401);   // 401, unauthorized
						}

						handleHttpRequest(buildTarget, params, cb);
					});
				});

				callback();
			}
		},
		cb
	);
};

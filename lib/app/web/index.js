var mage = require('../../mage'),
    contexts = require('../contexts'),
    BuildTarget = require('../buildTarget').BuildTarget,
    Manifest = require('./manifest').Manifest,
    zlib = require('zlib'),
    crypto = require('crypto'),
    async = require('async'),
    logger = mage.core.logger;

require('./webbuilder'); // included to allow it to self-register contexts and builder

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

	this.delivery = mage.core.config.get('apps.' + name + '.delivery') || {};

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
	var that = this;

	that.densities.forEach(function (density) {
		that.languages.forEach(function (language) {
			that.screens.forEach(function (screen) {
				var config = makeClientConfig(language, density, screen);
				logger.verbose('Added new supported client config for app "' + name + '":', config);
				that.clientConfigs.push(config);
			});
		});
	});

	this.route = '/app/' + name;

	this.buildTargets = { indexPages: [], magePages: [], components: [], manifest: null };
	this.pages = {};
	this.components = {};
	this.digests = {};
	this.manifest = null;

	// create a single command center for this app

	this.commandCenter = new mage.core.cmd.CommandCenter(this);

	// create an asset map for this app

	if (mage.assets) {
		this.assetMap = new mage.assets.AssetMap(this);
	}

	// Make this.firewall a function that receives a net.Socket, and
	// returns a boolean that indicates if the client is allowed access or not.

	this.firewall = null;

	mage.core.app.register(name, this);
}


exports.WebApp = WebApp;


WebApp.prototype.setIndexPage = function (path, options) {
	return this.addIndexPage('index', path, options);
};


WebApp.prototype.addIndexPage = function (name, path, options, assetOptions) {
	options = options || {};

	var routes = [];
	var context = contexts.get('html');
	var firstRoute;

	if (options.route) {
		// create a special route

		routes.push(this.route + '/' + options.route);

		firstRoute = options.route;
	} else if (options.routes) {
		// create many special routes

		firstRoute = options.routes[0];

		for (var i = 0, len = options.routes.length; i < len; i += 1) {
			routes.push(this.route + '/' + options.routes[i]);
		}
	} else {
		// no special routes, so we make it the app route

		routes.push(this.route);
	}

	// Because we cannot reliably attach properties to a buildTarget, we stick
	// it in the options.

	options.pageName = name;

	var page = new BuildTarget(this, 'dir', path, context, routes, options, true);

	page.pageName = name;

	this.pages[name] = page;
	this.buildTargets.indexPages.push(page);

	if (assetOptions && firstRoute) {
		this.assetMap.addPage(assetOptions.context, assetOptions.descriptor, name, firstRoute);
	}

	return page;
};


WebApp.prototype.registerComponent = function (name, path) {
	var options = { path: path };

	var context = contexts.get('component');
	var route = '/app/' + this.name + '/' + name;

	var component = new BuildTarget(this, 'web', name, context, [route], options, true);

	component.componentName = name;
	component.path = path;

	this.components[name] = component;
	this.buildTargets.components.push(component);

	return component;
};


WebApp.prototype.addPage = function (name, path, options) {
	options = options || {};

	options.path = path;

	var context = contexts.get('magepage');
	var route = '/app/' + this.name + '/' + name;

	var page = new BuildTarget(this, 'web', name, context, [route], options, true);

	page.pageName = name;

	this.pages[name] = page;
	this.buildTargets.magePages.push(page);

	return page;
};


WebApp.prototype.getPage = function (name) {
	return this.pages[name] || null;
};


WebApp.prototype.getComponent = function (name) {
	return this.components[name] || null;
};


WebApp.prototype.getPageVariants = function (pageName) {
	var variants = [];
	var digests = this.digests[pageName] || {};

	for (var i = 0, len = this.clientConfigs.length; i < len; i += 1) {
		var clientConfig = this.clientConfigs[i];

		// clientConfig.language, .density, .screen

		var digest = digests[clientConfig._key];

		if (!digest) {
			logger.error('Could not find digest for page', pageName, 'in clientConfig', clientConfig._key, '(this is fine during development)');
		}

		variants.push({
			language: clientConfig.language,
			density: clientConfig.density,
			screen: clientConfig.screen,
			digest: digest || mage.core.time
		});
	}

	return variants;
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
		this.buildTargets.manifest = buildTarget;
	} else {
		logger.verbose('HTML5 Application cache disabled, skipping build.');
	}

	return manifest;
};


WebApp.prototype.getManifestBuildTarget = function () {
	return this.buildTargets.manifest;
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
			logger.verbose('Build target', buildTarget.describe(), 'size:', data.length, 'bytes.');
			cb(null, headers, data, hash);
			return;
		}

		// gzip compress contents

		logger.verbose('Build target', buildTarget.describe(), 'size before gzip compression:', data.length, 'bytes.');

		var gzip = zlib.createGzip({ level: 9 }), buffers = [], nread = 0;

		gzip.on('error', function (err) {
			gzip.removeAllListeners('end');
			gzip.removeAllListeners('error');

			logger.error('Gzip compression failed, serving uncompressed file:', err);

			cb(null, headers, data, hash);
		});

		gzip.on('data', function (chunk) {
			buffers.push(chunk);
			nread += chunk.length;
		});

		gzip.on('end', function () {
			var compressed = Buffer.concat(buffers, nread);

			logger.verbose('Build target', buildTarget.describe(), 'size after gzip compression:', compressed.length, 'bytes.');

			headers['Content-Encoding'] = 'gzip';

			cb(null, headers, compressed, hash);
		});

		gzip.end(data);
	});
}


function generateDigest(data) {
	if (!data) {
		logger.error('Cannot generate digest of 0-data');
		return false;
	}

	return crypto.createHash('sha1').update(data).digest('hex').slice(0, 8);
}


function prebuildHttpResponses(buildTarget, cb) {
	// responses: { "en-1,2-480x960": { headers: {}, data: buff, hash: 'abc' }, "ja-1,1.5-400x640": { headers: {}, data: buff, hash: 'abc' }, etc... }

	// note: the buildTarget is the html page, mage-page or the manifest

	var app = buildTarget.app;
	var pageName = buildTarget.pageName;

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

				// store the digest of the page/clientConfig

				if (!pageName) {
					// non-page case (eg: manifest)

					callback();
				}

				var digests = app.digests[pageName];
				if (!digests) {
					digests = app.digests[pageName] = {};
				}

				digests[clientConfig._key] = hash || generateDigest(data);

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


function createCachedRequestHandler(app, buildTarget, responses) {
	return function cachedRequestHandler(req, path, params, cb) {
		// check if this client is allowed to do this request

		if (app.firewall && !app.firewall(req.connection, req)) {
			return cb(401);   // 401, unauthorized
		}

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));
		if (clientConfig === null) {
			return cb(500);
		}

		// We tack on the pageName from the request so we can serve components
		// in the correct context. We probably need to stick it into _key as
		// well.

		if (params.pageName) {
			clientConfig.pageName = params.pageName;
		} else {
			// Let's do this on a per request basis.
			delete clientConfig.pageName;
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


function createRealTimeBuildRequestHandler(app, buildTarget) {
	return function realTimeBuildRequestHandler(req, path, params, cb) {
		// check if this client is allowed to do this request

		if (app.firewall && !app.firewall(req.connection, req)) {
			return cb(401);   // 401, unauthorized
		}

		// cb: function (httpCode, [out buffer or string, headers])

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));
		if (clientConfig === null) {
			return cb(500);
		}

		// We tack on the pageName from the request so we can serve components
		// in the correct context.

		if (params.pageName) {
			clientConfig.pageName = params.pageName;
		} else {
			// Let's do this on a per request basis.
			delete clientConfig.pageName;
		}

		serveBuildTarget(buildTarget, clientConfig, function (error, headers, data) {
			if (error) {
				logger.debug(error);
				cb(404);
			} else {
				cb(200, data, headers);
			}
		});
	};
}


WebApp.prototype.expose = function (cb) {
	logger.notice('Exposing application "' + this.name + '" on HTTP server.');

	// registers routes in the http server in order to serve pages

	var httpServer = mage.core.msgServer.getHttpServer();
	if (!httpServer) {
		logger.alert('Cannot expose web app', this.name, ', because there is no HTTP server available.');
		return cb('noHttpServer');
	}

	// generate array of buildTargets

	var buildTargets = this.buildTargets.indexPages.slice();

	if (this.buildTargets.manifest) {
		buildTargets.push(this.buildTargets.manifest);
	}

	// we create mage pages last, since they can contain asset maps (which may require indexpages to be digested)

	buildTargets = buildTargets.concat(this.buildTargets.magePages);

	buildTargets = buildTargets.concat(this.buildTargets.components);


	// expose each buildTarget

	var app = this;

	async.forEachSeries(
		buildTargets,
		function (buildTarget, callback) {
            // We leave this one as debug since most likely this is a presentable debug value for
            // game developer (to know if their build gets set properly)
			logger.verbose('Exposing build target:', buildTarget.describe());

			if (app.delivery.serverCache) {
				// if we have server cache, we pre-build the build target in each client config and register a route to it

				prebuildHttpResponses(buildTarget, function (error, responses) {
					if (error) {
						return callback(error);
					}

					var handler = createCachedRequestHandler(app, buildTarget, responses);

					buildTarget.routes.forEach(function (route) {
						logger.verbose('Registering route:', route);

						httpServer.addRoute(route, handler);
					});

					callback();
				});
			} else {
				// we do not use cache, so we register a route to the http handler that builds the buildTarget

				var handler = createRealTimeBuildRequestHandler(app, buildTarget);

				buildTarget.routes.forEach(function (route) {
					logger.verbose('Registering route:', route);

					httpServer.addRoute(route, handler);
				});

				callback();
			}
		},
		cb
	);
};

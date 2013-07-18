var mage = require('../../mage');
var contexts = require('../contexts');
var BuildTarget = require('../buildTarget').BuildTarget;
var Manifest = require('./manifest').Manifest;
var zlib = require('zlib');
var crypto = require('crypto');
var async = require('async');
var logger = mage.core.logger;

require('./webbuilder'); // included to allow it to self-register contexts and builder

var DEFAULT_CLIENT_CONFIG = {
	language: 'en',
	density: 1,
	screen: [1, 1]
};


function makeClientConfig(language, density, screen) {
	var obj = {
		language: language && language.toLowerCase() || DEFAULT_CLIENT_CONFIG.language,
		density: Number(density || DEFAULT_CLIENT_CONFIG.density)
	};

	if (typeof screen === 'string') {
		screen = screen.split(/[x,]/).map(Number);
	}

	if (Array.isArray(screen)) {
		// Ensures [short edge, long edge] order
		obj.screen = screen.sort();
	} else {
		obj.screen = DEFAULT_CLIENT_CONFIG.screen;
	}

	if (typeof obj.density !== 'number') {
		logger.error('Bad density:', obj.density);
		return;
	}

	if (obj.screen.length !== 2 || !Number.isFinite(obj.screen[0]) || !Number.isFinite(obj.screen[1])) {
		logger.error('Bad screen:', obj.screen);
		return;
	}

	obj._key = obj.language + '-' + obj.density + '-' + obj.screen.join('x');

	return obj;
}


// Get the best supported config based on what the client provides.
function getBestConfig(buildTarget, clientConfig) {
	var configs = buildTarget.app.clientConfigs;
	var numConfigs = parseInt(configs.length, 10);
	var best;
	var bestScreen = [-1, -1];

	if (!clientConfig) {
		return;
	}

	while (numConfigs > 0) {
		numConfigs -= 1;
		var candidate = configs[numConfigs];

		if (candidate.language !== clientConfig.language) {
			continue;
		}

		if (candidate.density !== clientConfig.density) {
			continue;
		}

		if (candidate.screen > clientConfig.screen) {
			continue;
		}

		if (candidate.screen < bestScreen) {
			continue;
		}

		best = candidate;
		bestScreen = candidate.screen;
	}

	return best;
}


// serveBuildTarget creates an HTTP response for the given buildTarget, and returns a hash to describe it

function serveBuildTarget(buildTarget, clientConfig, cb) {
	buildTarget.build(clientConfig, function (error, data, meta) {
		if (error) {
			return cb(error);
		}

		var hash = meta ? meta.hash : undefined;
		var headers = {};

		// set the proper mimetype

		headers['Content-Type'] = buildTarget.context.mimetype;

		// uncompressed response

		if (!buildTarget.app.delivery.compress) {
			logger.verbose('Build target', buildTarget.describe(), 'size:', data.length, 'bytes.');
			return cb(null, headers, data, hash);
		}

		// gzip compress contents

		logger.verbose('Build target', buildTarget.describe(), 'size before gzip compression:', data.length, 'bytes.');

		var gzip = zlib.createGzip({ level: 9 }), buffers = [], nread = 0;

		gzip.on('error', function (err) {
			gzip.removeAllListeners('end');
			gzip.removeAllListeners('error');

			logger.alert('Gzip compression failed, serving uncompressed file:', err);

			return cb(null, headers, data, hash);
		});

		gzip.on('data', function (chunk) {
			buffers.push(chunk);
			return nread += chunk.length;
		});

		gzip.on('end', function () {
			var compressed = Buffer.concat(buffers, nread);

			logger.verbose('Build target', buildTarget.describe(), 'size after gzip compression:', compressed.length, 'bytes.');

			headers['Content-Encoding'] = 'gzip';

			return cb(null, headers, compressed, hash);
		});

		return gzip.end(data);
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
	// note: the buildTarget is the index page, mage-page, component-page or the manifest

	var app = buildTarget.app;
	var responses = {};

	var digests;

	if (buildTarget.pageName) {
		digests =  app.digests[buildTarget.pageName];

		if (!digests) {
			digests = app.digests[buildTarget.pageName] = {};
		}
	}

	function buildForConfig(clientConfig, callback) {
		serveBuildTarget(buildTarget, clientConfig, function (error, headers, data, hash) {
			if (error) {
				return callback(error);
			}

			// register the response on the client config

			responses[clientConfig._key] = {
				headers: headers,
				data: data,
				hash: hash
			};

			if (digests) {
				// store the digest of the page/clientConfig

				digests[clientConfig._key] = hash || generateDigest(data);
			}

			return callback();
		});
	}

	async.forEachSeries(
		app.clientConfigs,
		buildForConfig,
		function (error) {
			cb(error, responses);
		}
	);
}


function createCachedRequestHandler(app, buildTarget, responses) {
	return function (req, path, params, cb) {
		// check if this client is allowed to do this request

		if (app.firewall && !app.firewall(req.connection, req)) {
			return cb(401);   // 401, unauthorized
		}

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));

		if (!clientConfig) {
			logger.debug.data({
				language: params.language || null,
				density: params.density || null,
				screen: params.screen || null
			}).log('No compatible client config found');

			return cb(404);
		}

		var response = responses[clientConfig._key];

		if (!response) {
			return cb(404);
		}

		if (response.hash && response.hash === params.hash) {
			return cb(200, 'usecache', { 'Content-type': 'text/plain; charset=utf8' });
		}

		return cb(200, response.data, response.headers);
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

		if (!clientConfig) {
			logger.debug.data({
				language: params.language || null,
				density: params.density || null,
				screen: params.screen || null
			}).log('No compatible client config found');

			return cb(404);
		}

		return serveBuildTarget(buildTarget, clientConfig, function (error, headers, data) {
			if (error) {
				return cb(404);
			}

			return cb(200, data, headers);
		});
	};
}


function WebApp(name, options) {
	// options: {
	//     access: "anonymous/user/admin",
	//     responseCache: 10,
	//     delivery: {
	//         clientConfigs: {
	//             languages: ["en", "ja"],
	//             densities: [1],
	//             screens: [[320, 480], [768, 1024]]
	//         },
	//         serverCache: false,
	//         useManifest: false,
	//         compress: true,
	//         postprocessors: { css: "less", js: [] }
	//     }
	// }

	this.name = name;
	this.access = options.access || mage.core.access.getLowestLevel();

	var delivery = options.delivery || {};
	var clientConfigs = delivery.clientConfigs || {};

	if (!clientConfigs.languages || clientConfigs.languages.length === 0) {
		clientConfigs.languages = [DEFAULT_CLIENT_CONFIG.language];
	}

	if (!clientConfigs.densities || clientConfigs.densities.length === 0) {
		clientConfigs.densities = [DEFAULT_CLIENT_CONFIG.density];
	}

	if (!clientConfigs.screens || clientConfigs.screens.length === 0) {
		clientConfigs.screens = [DEFAULT_CLIENT_CONFIG.screen];
	}

	this.delivery = delivery;

	this.languages = clientConfigs.languages.map(function (lang) {
		return lang.toLowerCase();
	});

	this.densities = clientConfigs.densities;

	this.screens = clientConfigs.screens.map(function (screen) {
		return screen.sort();
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
}

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

		firstRoute = this.route;
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


WebApp.prototype.registerComponent = function (name, path, requiredBy, options) {
	var componentOptions = options || {};

	componentOptions.path = path;
	componentOptions.requiredBy = requiredBy;

	var context = contexts.get('component');
	var route = '/app/' + this.name + '/' + name;

	var component = new BuildTarget(this, 'web', name, context, [route], componentOptions, true);

	component.pageName = name;
	component.path = path;

	this.components[path] = component;
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
	return this.pages[name];
};


WebApp.prototype.getComponent = function (path) {
	return this.components[path];
};


WebApp.prototype.getPageVariants = function (pageName) {
	var variants = [];
	var digests = this.digests[pageName] || {};

	for (var i = 0, len = this.clientConfigs.length; i < len; i += 1) {
		var clientConfig = this.clientConfigs[i];

		// clientConfig.language, .density, .screen

		var digest = digests[clientConfig._key];

		if (!digest) {
			logger.error('Could not find digest for page', pageName, 'in clientConfig', clientConfig._key, 'for app', this.name, '(this is fine during development)');
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
		return;
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


WebApp.prototype.expose = function (cb) {
	logger.emergency('app.expose(cb) has been deprecated. App exposing is now automatic, so just remove the call where you expose:', this.name);
	process.nextTick(cb);
};


WebApp.prototype.exposeOnClientHost = function (cb) {
	// registers routes in the http server in order to serve pages

	var httpServer = mage.core.msgServer.getHttpServer();

	if (!httpServer) {
		logger.alert('Cannot expose web app "' + this.name + '" because there is no HTTP server available.');
		return cb('noHttpServer');
	}

	// generate array of buildTargets

	var allBuildTargets = this.buildTargets.indexPages.slice();

	if (this.buildTargets.manifest) {
		allBuildTargets.push(this.buildTargets.manifest);
	}

	// we create mage pages last, since they can contain asset maps (which may require indexpages to be digested)

	allBuildTargets = allBuildTargets.concat(this.buildTargets.magePages);

	allBuildTargets = allBuildTargets.concat(this.buildTargets.components);


	// expose each buildTarget

	var app = this;

	function setupHandlers(buildTarget, callback) {
        // We leave this one as debug since most likely this is a presentable debug value for
        // game developer (to know if their build gets set properly)

		logger.verbose('Exposing build target:', buildTarget.describe());

		// we do not use cache, so we register a route to the http handler that builds the buildTarget

		if (!app.delivery.serverCache) {
			var handler = createRealTimeBuildRequestHandler(app, buildTarget);

			buildTarget.routes.forEach(function (route) {
				logger.verbose('Registering route:', route);

				httpServer.addRoute(route, handler);
			});

			return callback();
		}

		// if we have server cache, we pre-build the build target in each client config and register a route to it

		return prebuildHttpResponses(buildTarget, function (error, responses) {
			if (error) {
				return callback(error);
			}

			var handler = createCachedRequestHandler(app, buildTarget, responses);

			buildTarget.routes.forEach(function (route) {
				logger.verbose('Registering route:', route);

				httpServer.addRoute(route, handler);
			});

			return callback();
		});
	}

	async.forEachSeries(
		allBuildTargets,
		setupHandlers,
		function () {
			// log exposed URLs

			app.buildTargets.indexPages.forEach(function (buildTarget) {
				var details = buildTarget.routes.map(function (route) {
					return httpServer.getRouteUrl(route);
				});

				logger.notice('Exposed application "' + app.name + '" at:', details.join(', '));
			});

			cb();
		}
	);
};

exports.WebApp = WebApp;

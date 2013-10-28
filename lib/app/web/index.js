var mage = require('../../mage');
var contexts = require('../contexts');
var BuildTarget = require('../buildTarget').BuildTarget;
var Manifest = require('./manifest').Manifest;
var zlib = require('zlib');
var crypto = require('crypto');
var async = require('async');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pathJoin = require('path').join;
var mkdirp = require('mkdirp');
var fs = require('fs');

var logger = mage.core.logger.context('WebApp');

require('./webbuilder'); // included to allow it to self-register contexts and builder

var DEFAULT_CLIENT_CONFIG = {
	language: 'en',
	density: 1,
	screen: [1, 1]
};


/**
 * Takes arguments to turn into a safe path where a build can be stored.
 *
 * @param {string} rootPath        The builds folder.
 * @param {string} buildTargetName The name of the BuildTarget object.
 * @param {string} clientConfigKey The key that describes ClientConfig.
 * @returns {string}               The path for this build target + client config combination.
 */

function createBuildPath(rootPath, buildTargetName, clientConfigKey) {
	function escape(str) {
		return encodeURIComponent(str).replace(/\*/g, '%2A');
	}

	return pathJoin(rootPath, escape(buildTargetName), escape(clientConfigKey));
}


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


// buildToHttpResponse creates an HTTP response for the given buildTarget, and returns a hash to describe it

function buildToHttpResponse(buildTarget, clientConfig, cb) {
	logger.notice('Building:', buildTarget.describe(), 'for app:', buildTarget.app.name, 'using client config:', clientConfig);

	buildTarget.app.emit('build', buildTarget, clientConfig);

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


function createCachedRequestHandler(buildTarget, responses) {
	var app = buildTarget.app;

	return function (req, path, params, cb) {
		// check if this client is allowed to do this request

		var hookResponse = app.checkRequestHooks(req, path, params, 'webapp');
		if (hookResponse) {
			return cb(hookResponse.code, hookResponse.output, hookResponse.headers);
		}

		var clientConfig = getBestConfig(buildTarget, makeClientConfig(params.language, params.density, params.screen));

		if (!clientConfig) {
			logger.warning.data({
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


function createRealTimeBuildRequestHandler(buildTarget) {
	var app = buildTarget.app;

	return function realTimeBuildRequestHandler(req, path, params, cb) {
		// check if this client is allowed to do this request

		var hookResponse = app.checkRequestHooks(req, path, params, 'webapp');
		if (hookResponse) {
			return cb(hookResponse.code, hookResponse.output, hookResponse.headers);
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

		return buildToHttpResponse(buildTarget, clientConfig, function (error, headers, data) {
			if (error) {
				logger.alert(error);
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
	//         useManifest: false,
	//         compress: true,
	//         postprocessors: { css: "less", js: [] }
	//     }
	// }

	// make WebApp an EventEmitter so builders etc can emit events on it

	EventEmitter.call(this);

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

	if (this.delivery.hasOwnProperty('serverCache')) {
		logger.warning('The configuration entry "apps.' + name + '.delivery.serverCache" has been deprecated in favor of development mode.');
	}

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
	this.buildPath = pathJoin(process.cwd(), 'build', name.replace(/\//g, '_'));
	this.prebuild = !mage.isDevelopmentMode();  // we never prebuild while developing

	this.buildTargets = { indexPages: [], magePages: [], components: [], manifest: null };
	this.pages = {};
	this.components = {};
	this.manifest = null;

	// create a single command center for this app

	this.commandCenter = new mage.core.cmd.CommandCenter(this);

	// create an asset map for this app

	this.assetMap = mage.assets ? new mage.assets.AssetMap(this) : null;

	// Make this.firewall a function that receives a net.Socket, and
	// returns a boolean that indicates if the client is allowed access or not.
	// THIS IS NOW DEPRECATED AND SHOULD NOT BE USED

	this.firewall = null;

	// Array of request hooks to be executed on each request we receive

	this.requestHooks = null;
}


util.inherits(WebApp, EventEmitter);


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

	if (assetOptions && firstRoute && this.assetMap) {
		this.assetMap.addPage(assetOptions.context, assetOptions.descriptor, name, firstRoute);
	}

	return page;
};


WebApp.prototype.registerComponent = function (name, path, requiredBy, options) {
	options = options || {};

	options.path = path;
	options.requiredBy = requiredBy;

	var context = contexts.get('component');
	var route = '/app/' + this.name + '/' + name;

	var component = new BuildTarget(this, 'web', name, context, [route], options, true);

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


WebApp.prototype.getComponentCandidatePaths = function () {
	// optimistically returns all paths that may or should contain components

	var trg = this.buildTargets;
	var result = [];

	result = result.concat(trg.indexPages.map(function (page) {
		return page.key;
	}));

	result = result.concat(trg.components.map(function (component) {
		return component.options.path;
	}));

	return result;
};


WebApp.prototype.getIndexPageVariants = function (pageName) {
	// get the index page BuildTarget

	var buildTarget = this.getPage(pageName);
	if (!buildTarget) {
		throw new Error('Index page "' + pageName + '" does not exist on app "' + this.name + '"');
	}

	var responses = buildTarget.responseCache;

	if (!responses) {
		if (this.prebuild) {
			throw new Error('No HTTP responses have been cached for index page "' + pageName + '" for app "' + this.name + '"');
		}

		responses = {};
	}

	var that = this;

	return this.clientConfigs.map(function (clientConfig) {
		// clientConfig.language, .density, .screen

		var response = responses[clientConfig._key];

		if (!response && that.prebuild) {
			throw new Error('No HTTP response has been cached for client config "' + clientConfig._key + '" for index page "' + pageName + '" for app "' + that.name + '"');
		}

		return {
			clientConfig: clientConfig,
			digest: response ? (response.hash || generateDigest(response.data)) : parseInt(Date.now() / 1000, 10)
		};
	});
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


WebApp.prototype.listBuildTargets = function () {
	var result = this.buildTargets.indexPages.slice();

	if (this.buildTargets.manifest) {
		result.push(this.buildTargets.manifest);
	}

	// we create mage pages and components last, since they can contain asset maps (which may require indexpages to be digested)

	result = result.concat(this.buildTargets.magePages);

	result = result.concat(this.buildTargets.components);

	return result;
};


WebApp.prototype.makeBuilds = function (cb) {
	if (!this.prebuild) {
		return cb();
	}

	// responses: { "en-1,2-480x960": { headers: {}, data: buff, hash: 'abc' }, "ja-1,1.5-400x640": { headers: {}, data: buff, hash: 'def' }, etc... }
	// note: the buildTarget is the index page, mage-page, component-page or the manifest

	var that = this;

	function buildResponse(buildTarget, clientConfig, callback) {
		if (buildTarget.responseCache[clientConfig._key]) {
			logger.verbose('Build for', buildTarget.describe(), 'with client config', clientConfig._key, 'already loaded, skipping.');
			return callback();
		}

		buildToHttpResponse(buildTarget, clientConfig, function (error, headers, data, hash) {
			if (error) {
				return callback(error);
			}

			// register the response for this client config

			buildTarget.responseCache[clientConfig._key] = {
				headers: headers,
				data: data,
				hash: hash
			};

			callback();
		});
	}

	async.eachSeries(
		this.listBuildTargets(),
		function (buildTarget, callback) {
			// for this buildTarget and each clientConfig, create and register a response object

			if (!buildTarget.responseCache) {
				buildTarget.responseCache = {};
			}

			async.eachSeries(
				that.clientConfigs,
				function (clientConfig, callback) {
					buildResponse(buildTarget, clientConfig, callback);
				},
				callback
			);
		},
		cb
	);
};


WebApp.prototype.cleanBuilds = function (cb) {
	logger.debug('Deleting builds at path:', this.buildPath);

	function rm(path, callback) {
		fs.stat(path, function (error, stats) {
			if (error) {
				if (error.code === 'ENOENT') {
					return callback();
				}

				logger.emergency('Error stat-ing path:', path, error);
				return callback(error);
			}

			if (stats.isDirectory()) {
				fs.readdir(path, function (error, files) {
					if (error) {
						logger.emergency('Error reading from directory:', path, error);
						return callback(error);
					}

					async.eachSeries(
						files,
						function (file, callback) {
							rm(pathJoin(path, file), callback);
						},
						function (error) {
							if (error) {
								return callback(error);
							}

							// now remove the folder itself

							fs.rmdir(path, callback);
						}
					);
				});
			} else {
				fs.unlink(path, function (error) {
					if (error) {
						logger.emergency('Could not remove file:', path, error);
					}

					callback(error);
				});
			}
		});
	}

	rm(this.buildPath, cb);
};


WebApp.prototype.loadBuilds = function (cb) {
	if (!this.prebuild) {
		return cb();
	}

	logger.debug('Attempting to load builds for app:', this.name);

	var that = this;

	function loadBuilds(buildTarget, callback) {
		buildTarget.responseCache = {};

		function loadBuildForConfig(clientConfig, callback) {
			var buildPath = createBuildPath(that.buildPath, buildTarget.describe(), clientConfig._key);

			var headersPath = pathJoin(buildPath, 'headers.json');
			var dataPath = pathJoin(buildPath, 'data.bin');
			var hashPath = pathJoin(buildPath, 'hash.txt');

			var response = {};

			function load(callback) {
				logger.debug('Loading build from disk:', buildPath);

				async.series([
					function (callback) {
						fs.readFile(headersPath, function (error, headers) {
							if (error) {
								return callback(error);
							}

							response.headers = JSON.parse(headers);
							callback();
						});
					},
					function (callback) {
						fs.readFile(dataPath, function (error, data) {
							if (error) {
								return callback(error);
							}

							response.data = data;
							callback();
						});
					},
					function (callback) {
						fs.readFile(hashPath, function (error, hash) {
							if (error) {
								if (error.code === 'ENOENT') {
									return callback();
								}

								return callback(error);
							}

							response.hash = hash.toString();
							callback();
						});
					}
				], function (error) {
					if (error) {
						logger.emergency('Error loading build file:', error);
						return callback(error);
					}

					buildTarget.responseCache[clientConfig._key] = response;

					callback();
				});
			}

			// if headers and data files exist, start loading

			fs.exists(buildPath, function (exists) {
				if (exists) {
					load(callback);
				} else {
					logger.verbose('Could not find build at', buildPath);

					callback();
				}
			});
		}

		async.eachSeries(that.clientConfigs, loadBuildForConfig, callback);
	}

	var allBuildTargets = this.listBuildTargets();

	async.eachSeries(allBuildTargets, loadBuilds, cb);
};


WebApp.prototype.storeBuilds = function (cb) {
	var that = this;

	function storeBuilds(buildTarget, callback) {
		var responses = buildTarget.responseCache;

		if (!responses) {
			logger.debug('No cached responses available for build target:', buildTarget.describe());

			return callback();
		}

		var clientConfigKeys = Object.keys(responses);

		function storeBuildForConfigKey(clientConfigKey, callback) {
			var response = responses[clientConfigKey];  // { headers, data, [hash] }
			var buildPath = createBuildPath(that.buildPath, buildTarget.describe(), clientConfigKey);

			async.series([
				function (callback) {
					mkdirp(buildPath, callback);
				},
				function (callback) {
					fs.writeFile(pathJoin(buildPath, 'headers.json'), JSON.stringify(response.headers), callback);
				},
				function (callback) {
					fs.writeFile(pathJoin(buildPath, 'data.bin'), response.data, callback);
				},
				function (callback) {
					fs.writeFile(pathJoin(buildPath, 'hash.txt'), response.hash ? (response.hash + '') : '', callback);
				}
			], callback);
		}

		async.eachSeries(
			clientConfigKeys,
			storeBuildForConfigKey,
			function (error) {
				if (error) {
					logger.emergency('Error storing build:', error);
					return callback(error);
				}

				logger.debug('Stored builds:', buildTarget.describe());
				callback();
			}
		);
	}

	var allBuildTargets = this.listBuildTargets();

	this.cleanBuilds(function (error) {
		if (error) {
			return cb(error);
		}

		async.eachSeries(allBuildTargets, storeBuilds, cb);
	});
};


WebApp.prototype.exposeOnClientHost = function () {
	// registers routes in the http server in order to serve pages

	var httpServer = mage.core.msgServer.getHttpServer();

	if (!httpServer) {
		throw new Error('Cannot expose web app "' + this.name + '" because there is no HTTP server available.');
	}

	// create firewall hook if it exists with deprecation warning

	var app = this;

	if (app.firewall) {
		logger.warning('app.firewall has been deprecated in favor of registerRequestHook API function.');

		this.registerRequestHook(function (req) {
			if (!app.firewall(req.connection, req)) {
				logger.error.data('request', req).log('Firewall blocked request');
				return { code: 401, headers: null, output: null };
			}
		});
	}

	// expose each buildTarget

	function setupHandlers(buildTarget) {
        // We leave this one as debug since most likely this is a presentable debug value for
        // game developer (to know if their build gets set properly)

		logger.verbose('Exposing build target:', buildTarget.describe());

		var handler;

		if (buildTarget.responseCache) {
			handler = createCachedRequestHandler(buildTarget, buildTarget.responseCache);
		} else {
			handler = createRealTimeBuildRequestHandler(buildTarget);
		}

		buildTarget.routes.forEach(function (route) {
			logger.verbose('Registering route:', route);

			httpServer.addRoute(route, handler);
		});
	}

	this.listBuildTargets().forEach(setupHandlers);

	// log exposed URLs

	app.buildTargets.indexPages.forEach(function (buildTarget) {
		var details = buildTarget.routes.map(function (route) {
			return httpServer.getRouteUrl(route);
		});

		logger.notice('Exposed application "' + app.name + '" at:', details.join(', '));
	});
};

/**
 * Function which registers a hook function which will be executed on each WebApp request.
 * 
 * @param {Function} hook - Hook function to be executed. This funciton needs to be in the form of
 * function (req, path, params, requestType), and only return an error object on failures.
 */
WebApp.prototype.registerRequestHook = function (hook) {
	this.requestHooks = this.requestHooks || [];
	this.requestHooks.push(hook);
};

/**
 * This is an internal function which executes all hooks on each request. It was made a prototype
 * function as requests are executed both internally and from the http transport msgServer.
 * 
 * @param {Object} req - The request object passed through from the http server instance.
 * @param {string} path - URI path of request.
 * @param {Object} params - Either the full 'urlInfo' object or just its 'query' params.
 * @param {string} requestType - Type of request, currently will only be either command or webapp.
 * @returns {Object} Should return undefined when successful, or an object with error code etc. on
 * failure.
 */
WebApp.prototype.checkRequestHooks = function (req, path, params, requestType) {
	if (!this.requestHooks) {
		return;
	}

	for (var i = 0; i < this.requestHooks.length; i++) {
		var hook = this.requestHooks[i];

		var hookResponse = hook(req, path, params, requestType);
		if (hookResponse) {
			return hookResponse;
		}
	}
};

exports.WebApp = WebApp;

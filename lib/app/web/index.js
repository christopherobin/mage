var mithril = require('../../mithril'),
    webbuilder = require('./webbuilder'),	// included to allow it to self-register contexts and builder
    contexts = require('../contexts'),
    builders = require('../builders'),
    BuildTarget = require('../buildTarget').BuildTarget,
    Manifest = require('./manifest').Manifest,
    async = require('async');


// defaults:

exports.defaultLanguage = 'EN';


function WebApp(name, options) {
	// options: languages: ['EN', 'JA']

	options = options || {};

	if (!options.languages || options.languages.length === 0) {
		options.languages = [exports.defaultLanguage];
	}

	this.delivery = mithril.core.config.get('apps.' + name + '.delivery') || {};

	this.name = name;
	this.languages = options.languages;

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
	var baseRoute = '/app/' + this.name;

	if (options.route) {
		// create a special route

		routes.push(baseRoute + '/' + options.route);
	} else if (options.routes) {
		// create many special routes

		for (var i = 0, len = options.routes.length; i < len; i++) {
			routes.push(baseRoute + '/' + options.routes[i]);
		}
	} else {
		// no special routes, so we make it the app route

		routes.push(baseRoute);
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


function serveBuildTarget(buildTarget, language, cb) {
	// serveBuildTarget creates an HTTP response for the given buildTarget, and returns a hash to describe it

	buildTarget.build(language, function (error, data, meta) {
		if (error) {
			return cb(error);
		}

		var headers = {};
		headers['Content-type'] = buildTarget.context.mimetype;

		// gzip compress contents

		if (buildTarget.app.delivery.compress) {
			var gzip = require('compress-buffer');

			if (typeof data === 'string') {
				data = new Buffer(data);
			}

			mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size before gzip compression: ' + data.length + ' bytes.');

			var compressed = gzip.compress(data);
			if (compressed) {
				headers['Content-Encoding'] = 'gzip';

				data = compressed;

				mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size after gzip compression: ' + data.length + ' bytes.');
			} else {
				mithril.core.logger.error('Gzip compression failed, serving uncompressed file.');
			}
		} else {
			mithril.core.logger.info('Build target ' + buildTarget.describe() + ' size: ' + data.length + ' bytes.');
		}

		// serve the content

		if (meta && meta.hash) {
			cb(null, headers, data, meta.hash);
		} else {
			cb(null, headers, data);
		}
	});
}


function handleHttpRequest(buildTarget, params, cb) {
	// cb: function (httpCode, [out buffer or string, headers])

	var language = params.language || exports.defaultLanguage;

	serveBuildTarget(buildTarget, language, function (error, headers, data) {
		if (error) {
			cb(404);
		} else {
			cb(200, data, headers);
		}
	});
}


function sendCachedResponse(params, responses, cb) {
	var language = params.language || exports.defaultLanguage;

	var response = responses[language];
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
	// responses: { EN: { headers: {}, data: buff, hash: 'abc' }, JA: { headers: {}, data: buff, hash: 'abc' }, etc... }

	var languages = buildTarget.app.languages;
	var responses = {};

	async.forEachSeries(
		languages,
		function (language, callback) {
			serveBuildTarget(buildTarget, language, function (error, headers, data, hash) {
				if (error) {
					callback(error);
				} else {
					// register the response on the language

					responses[language] = { headers: headers, data: data, hash: hash };

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
				// if we have server cache, we pre-build the build target in each language and register a route to it

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

							sendCachedResponse(params, responses, cb);
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

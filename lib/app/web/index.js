var mithril = require('../../mithril'),
    webbuilder = require('./webbuilder'),	// included to allow it to self-register contexts and builder
    contexts = require('../contexts'),
    builders = require('../builders'),
    BuildTarget = require('../buildTarget').BuildTarget,
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
//	this.paths = {};
	this.buildTargets = {};

	// select builders that this app will have access to (extended by developers through addBuilder())
	// TODO: is this really needed? also, the following 2 lines are the only reason for require('builders')

	this.builders = {
		web: mithril.core.app.builders.get('web'),		// <- TODO: should become a builder called "web", which does manifest
		assets: mithril.core.app.builders.get('assets')
	};
}


exports.WebApp = WebApp;


WebApp.prototype.addBuildTarget = function (buildTarget) {
	// internal usage

	if (this.buildTargets.hasOwnProperty(buildTarget.name)) {
		mithril.core.logger.info('Warning: overwriting build target', buildTarget.name);
	}

	this.buildTargets[buildTarget.name] = buildTarget;
};


WebApp.prototype.setIndexPage = function (path, options) {
	var context = contexts.get('html');
	var routes = ['/app/' + this.name];
	var name = 'index';
/*
	options = options || {};
	options.path = path;
*/
	this.addBuildTarget(new BuildTarget(this, path, 'dir', context, routes, options, true));
};


WebApp.prototype.addPage = function (name, path, options) {
	var context = contexts.get('mithrilpage');
	var routes = ['/app/' + this.name + '/' + name];

	options = options || {};
	options.path = path;

	name = 'page.' + name;

	this.addBuildTarget(new BuildTarget(this, name, 'web', context, routes, options, true));
};


WebApp.prototype.getPage = function (name) {
	name = 'page.' + name;

	return this.buildTargets[name] || null;
};


WebApp.prototype.setManifest = function (manifest) {
	if (!this.delivery.useManifest) {
		mithril.core.logger.info('HTML5 Application cache disabled, skipping build.');
		return;
	}

	var context = contexts.get('manifest');
	var routes = ['/app/' + this.name + '/app.manifest'];

	options = options || {};
	options.manifest = manifest;

	var name = 'manifest';

	this.addBuildTarget(new BuildTarget(this, name, 'web', context, routes, options, true));
};


WebApp.prototype.getManifest = function () {
	var name = 'manifest.' + this.name;

	return this.buildTargets[name] || null;
};


/*
WebApp.prototype.setPath = function (key, relPath) {
	this.paths[key] = relPath;
};
*/

WebApp.prototype.addBuilder = function (key, fn) {
	this.builders[key] = fn;
};


WebApp.prototype.getPostProcessors = function (contextName) {
	var pp = this.delivery.postprocessors;
	if (pp) {
		var result = pp[contextName];

		if (result) {
			if (typeof result === 'string') {
				return [result];
			}

			return result;
		}
	}

	return null;
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

			mithril.core.logger.info('Build target ' + buildTarget.name + ' size before gzip compression: ' + data.length + ' bytes.');

			var compressed = gzip.compress(data);
			if (compressed) {
				headers['Content-Encoding'] = 'gzip';

				data = compressed;

				mithril.core.logger.info('Build target ' + buildTarget.name + ' size after gzip compression: ' + data.length + ' bytes.');
			} else {
				mithril.core.logger.error('Gzip compression failed, serving uncompressed file.');
			}
		} else {
			mithril.core.logger.info('Build target ' + buildTarget.name + ' size: ' + data.length + ' bytes.');
		}

		// serve the content

		if (meta && meta.hash) {
			cb(null, headers, data, meta.hash);
		} else {
			cb(null, headers, data);
		}
	});
}


function handleHttpRequest(buildTarget, req, path, params, cb) {
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


function addCachedFileRoute(httpServer, route, responses) {
	// responses: { EN: { headers: {}, data: buff, hash: 'abc' }, JA: { headers: {}, data: buff, hash: 'abc' }, etc... }

	httpServer.addRoute(route, function (req, path, params, cb) {
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
	});
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
			mithril.core.logger.info('Exposing build target:', buildTarget.name);

			if (app.delivery.serverCache) {
				// if we have server cache, we pre-build the build target in each language and register a route to it

				prebuildHttpResponses(buildTarget, function (error, responses) {
					if (error) {
						return callback(error);
					}

					buildTarget.routes.forEach(function (route) {
						addCachedFileRoute(httpServer, route, responses);
					});

					callback();
				});
			} else {
				// we do not use cache, so we register a route to the http handler that builds the buildTarget

				buildTarget.routes.forEach(function (route) {
					mithril.core.logger.debug('Registering dynamic build target route:', route);

					httpServer.addRoute(route, handleHttpRequest.bind(null, buildTarget));
				});

				callback();
			}
		},
		cb
	);
};

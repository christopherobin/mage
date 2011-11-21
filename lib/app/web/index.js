var mithril = require('../../mithril'),
    webpage = require('./webpage'),
	contexts = require('../contexts'),
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
	this.paths = {};
	this.pages = {};

	this.builders = {
		page:   mithril.core.app.builders.get('page'),
		assets: mithril.core.app.builders.get('assets')
	};
}


exports.WebApp = WebApp;


WebApp.prototype.addPage = function (name, path, options) {
	this.pages[name] = new webpage.Page(this, name, path, options);
};


WebApp.prototype.setManifest = function (manifest) {
	this.manifest = manifest;
};


WebApp.prototype.setPath = function (key, relPath) {
	this.paths[key] = relPath;
};


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


function servePage(page, context, language, cb) {
	// servePage creates an HTTP response for page 'page' in either mithrilpage, html, css or js context

	webpage.build(page, language, context.name, page.name, function (error, data) {
		if (error) {
			return cb(error);
		}

		var headers = {};
		headers['Content-type'] = context.mimetype;

		// gzip compress contents

		if (page.app.delivery.compress) {
			var gzip = require('compress-buffer');

			if (typeof data === 'string') {
				data = new Buffer(data);
			}

			mithril.core.logger.info('Page ' + page.name + ' size before gzip compression: ' + data.length + ' bytes.');

			var compressed = gzip.compress(data);
			if (compressed) {
				headers['Content-Encoding'] = 'gzip';

				data = compressed;

				mithril.core.logger.info('Page ' + page.name + ' size after gzip compression: ' + data.length + ' bytes.');
			} else {
				mithril.core.logger.error('Gzip compression failed, serving uncompressed file.');
			}
		} else {
			mithril.core.logger.info('Page ' + page.name + ' size: ' + data.length + ' bytes.');
		}

		// serve the page

		cb(null, headers, data);
	});
}


function handlePageRequest(page, context, req, path, params, cb) {
	// cb: function (httpCode, [out buffer or string, headers])

	var language = params.language || exports.defaultLanguage;

	servePage(page, context, language, function (error, headers, data) {
		if (error) {
			cb(404);
		} else {
			cb(200, data, headers);
		}
	});
}


function addCachedFileRoute(httpServer, route, responses) {
	// responses: { EN: { headers: {}, data: buff, JA: { headers: {}, data: buff }, etc... }

	httpServer.addRoute(route, function (req, path, params, cb) {
		var language = params.language || exports.defaultLanguage;

		var response = responses[language];
		if (response) {
			cb(200, response.data, response.headers);
		} else {
			cb(404);
		}
	});
}


function prebuildPageResponses(page, context, cb) {
	// responses: { EN: { headers: {}, data: buff, JA: { headers: {}, data: buff }, etc... }

	var languages = page.app.languages;
	var responses = {};

	async.forEachSeries(
		languages,
		function (language, callback) {
			servePage(page, context, language, function (error, headers, data) {
				if (error) {
					callback(error);
				} else {
					// register the response on the language

					responses[language] = { headers: headers, data: data };

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

	var pageList = [];

	for (var pageName in this.pages) {
		pageList.push(this.pages[pageName]);
	}

	var app = this;

	async.forEachSeries(
		pageList,
		function (page, callback) {
			mithril.core.logger.info('Exposing page:', page.name);

			var contextName;

			if (page.options.isAppIndex) {
				contextName = 'html';
			} else {
				contextName = 'mithrilpage';
			}

			var context = mithril.core.app.contexts.get(contextName);
			if (!context) {
				mithril.core.logger.error('Context', contextName, 'not found.');
				return callback('badContext');
			}

			// generate paths for this page, within this context

			var pagePaths = page.getPaths(context);

			if (app.delivery.serverCache) {
				// if we have server cache, we pre-build the page in each language and register a route to it

				prebuildPageResponses(page, context, function (error, responses) {
					if (error) {
						return callback(error);
					}

					pagePaths.forEach(function (pagePath) {
						addCachedFileRoute(httpServer, pagePath, responses);
					});

					callback();
				});
			} else {
				// we do not use cache, so we register a route to the page server

				pagePaths.forEach(function (pagePath) {
					mithril.core.logger.debug('Registering dynamic page route:', pagePath);

					httpServer.addRoute(pagePath, handlePageRequest.bind(null, page, context));
				});

				callback();
			}
		},
		cb
	);
};

var async = require('async'),
    fs = require('fs'),
    crypto = require('crypto'),
    mithril = require('../../mithril'),
	builders = require('../builders'),
	contexts = require('../contexts');


function Page(app, name, path, options) {
	options = options || {};
	options.delimiter = options.delimiter || '---page-part---';

	this.app = app;
	this.name = name;
	this.path = path;
	this.options = options;
}


exports.Page = Page;


function buildPageFile(page, language, context, cb) {
	mithril.core.app.builders.build('dir', page, language, context.name, page.path, function (error, data) {
		if (error) {
			return cb(error);
		}

		// apply post processing

		var ppNames = page.app.getPostProcessors(context.name);
		if (!ppNames || ppNames.length === 0) {
			return cb(null, data);
		}

		async.forEachSeries(
			ppNames,
			function (ppName, callback) {
				var postProcessor = context.postProcessors[ppName];
				if (!postProcessor) {
					mithril.core.logger.error('Unknown postprocessor:', ppName);
					return callback(error);
				}

				postProcessor(data, function (error, newdata) {
					if (!error) {
						data = newdata;
					}

					callback(error);
				});
			},
			function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, data);
			}
		);
	});
};


function buildFullPage(page, language, context, cb) {
	var tasks = [];

	if (page.options.assetmap) {
		tasks.push({ builder: 'assets', contextName: 'assetmap', key: null });
	}

	tasks.push({ builder: 'page', contextName: 'html', key: page.name });
	tasks.push({ builder: 'page', contextName: 'css',  key: page.name });
	tasks.push({ builder: 'page', contextName: 'js',   key: page.name });

	var response = '';

	async.forEachSeries(
		tasks,
		function (task, callback) {
			var build = mithril.core.app.builders.get(task.builder);

			if (!build) {
				mithril.core.logger.error('No builder called', task.builder, 'found.');
				return callback('noSuchBuilder');
			}

			var newContext = mithril.core.app.contexts.get(task.contextName);

			if (!newContext) {
				mithril.core.logger.error('Context', task.contextName, 'not found for application', page.app.name);
				return callback('badContext');
			}

			build(page, language, newContext.name, task.key, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (response.length > 0) {
					response += page.options.delimiter;
				}

				var mimetype = newContext.mimetype ? newContext.mimetype : 'text/plain';

				response += mimetype + '\n' + data;

				callback();
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			// calculate a hash on the response

			var hash = crypto.createHash('md5').update(response).digest('hex');

			var header = ['delimiter: ' + page.options.delimiter, 'hash: ' + hash];

			cb(null, header.join('\n') + '\n\n' + response);
		}
	);
}


exports.build = function (page, language, contextName, pageName, cb) {
	// this function builds webpages

	// given page is our current environment.
	// 'pageName' however, is the name of the page we want to build.
	// this is usually the same as 'page', but if pages embed other pages, they will be different,
	// and the page refered to by 'pageName' becomes our environment.

	mithril.core.logger.info('Building page', pageName, '(' + contextName + '), for language', language);

	// environment switch

	page = page.app.pages[pageName];

	if (!page) {
		mithril.core.logger.error('Page', pageName, 'not found.');
		return cb('pageNotFound');
	}

	// language check

	if (page.app.languages.indexOf(language) === -1) {
		mithril.core.logger.error('Unsupported language', language, 'for WebApp', page.app.name, '.');
		return cb('badLanguage');
	}

	// context information

	var context = mithril.core.app.contexts.get(contextName);

	if (!context) {
		mithril.core.logger.error('Unrecognized context for pages:', contextName);
		return cb('badContext');
	}

	// if context is mithrilpage, we should do up to 4 builds and combine them: assetmap, html, css, javascript

	if (contextName === 'mithrilpage') {
		buildFullPage(page, language, context, cb);
	} else {
		buildPageFile(page, language, context, cb);
	}
};


builders.add('page', exports.build.bind(exports));
builders.add('mithrilpage', exports.build.bind(exports));

contexts.add('html', 'text/html; charset=utf8', '\n').addFileExtensions(['html', 'htm']);
contexts.add('css',  'text/css; charset=utf8', '\n').addFileExtensions(['css']);
contexts.add('js',   'text/javascript; charset=utf8', '\n').addFileExtensions(['js']);
contexts.add('mithrilpage', 'text/mithrilpage; charset=utf8', '\n');


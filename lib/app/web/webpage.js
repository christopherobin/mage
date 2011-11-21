var async = require('async'),
    fs = require('fs'),
    crypto = require('crypto'),
    mithril = require('../../mithril'),
	builders = require('../builders'),
	contexts = require('../contexts');


function Page(app, name, options) {
	options = options || {};

	this.app = app;
	this.name = name;
	this.delimiter = options.delimiter || '---page-part---';
	this.options = options;
}


exports.Page = Page;


var baseFileNames = {
	html: 'page',
	css: 'styles',
	js: 'script'
};


function buildPageFile(page, language, context, pageName, cb) {
	// TODO: why not just buildDir??

	// create a list of possible filenames for building this page in the required context

	var fileNames = [];

	var baseFileName = baseFileNames[context.name];
	if (!baseFileName) {
		mithril.core.logger.error('No base filename known for context:', context.name);
		return cb('noBaseFileName');
	}

	for (var i = 0, len = context.ext.length; i < len; i++) {
		fileNames.push(baseFileName + '.' + context.ext[i]);
	}

	// page path configuration

	var pagesPath = page.app.paths.pages;
	if (!pagesPath) {
		mithril.core.logger.error('No path set for context "pages" in application "' + page.app.name + '".');
		return cb('noPagesPath');
	}

	var pagePath = pagesPath + '/' + page.name;

	// if no file is found, this is totally fine, and we return an empty string

	var finalFilePath;

	async.forEachSeries(
		fileNames,
		function (fileName, callback) {
			var filePath = pagePath + '/' + fileName;

			fs.stat(filePath, function (error, stats) {
				if (!error && stats && stats.isFile()) {
					if (finalFilePath) {
						mithril.core.logger.error('Found multiple build targets for page "' + page.name + '". Ignoring: ' + fileName);
					} else {
						finalFilePath = filePath;
					}
				}

				callback();
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			if (finalFilePath) {
				// build the found file

				mithril.core.app.builders.build('file', page, language, context.name, finalFilePath, function (error, data) {
					if (error) {
						return cb(error);
					}

					// run postprocessors

					var ppNames = page.app.getPostProcessors(context.name);
					if (!ppNames) {
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
			} else {
				mithril.core.logger.error('No content found for page "' + page.name + '". Attempted: ' + fileNames.join(', ') + ' in ', pagesPath);
				cb('noContent');
			}
		}
	);
}


function buildFullPage(page, language, context, pageName, cb) {
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
					response += page.delimiter;
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

			var header = ['delimiter: ' + page.delimiter, 'hash: ' + hash];

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
		buildFullPage(page, language, context, pageName, cb);
	} else {
		buildPageFile(page, language, context, pageName, cb);
	}
};


exports.setDefaultBuilders = function (webapp) {
};


builders.add('page', exports.build.bind(exports));
builders.add('mithrilpage', exports.build.bind(exports));

contexts.add('html', 'text/html; charset=utf8', '\n').addFileExtensions(['html', 'htm']);
contexts.add('css',  'text/css; charset=utf8', '\n').addFileExtensions(['css']);
contexts.add('js',   'text/javascript; charset=utf8', '\n').addFileExtensions(['js']);
contexts.add('mithrilpage', 'text/mithrilpage; charset=utf8', '\n');


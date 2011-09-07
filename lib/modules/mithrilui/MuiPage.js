var fs = require('fs'),
    async = require('async'),
    less = require('less'),
    mithril = require('../../mithril');


function loadCssWithLess(path, minify, cb) {
	mithril.core.logger.debug('Loading contents from: ' + path + ' and running it through "less".');

	fs.readFile(path, 'utf8', function (error, data) {
		if (error) {
			return cb(error);
		}

		var options = {
			paths: [require('path').dirname(path)],
			filename: path
		};

		var parser = new less.Parser(options);

		parser.parse(data, function (error, tree) {
			if (error) {
				return cb(error);
			}

			var cssData = tree.toCSS({ compress: !!minify });

			cb(null, cssData);
		});
	});
}


function getFileContents(path, cb) {
	var isCss = !!path.match(/\.(css|less)$/);

	if (isCss) {
		var minify = !!mithril.getConfig('module.mithrilui.delivery.page.css.minify');

		if (minify || path.match(/\.less$/)) {
			return loadCssWithLess(path, minify, cb);
		}
	}

	mithril.core.logger.debug('Loading contents from: ' + path);

	fs.readFile(path, 'utf8', cb);
}


function getFilesRecursive(path, matcher, glue, cb) {
	mithril.core.logger.debug('Reading entire directory structure: ' + path + ', using matcher: ' + matcher);

	if (typeof glue !== 'string') {
		glue = '';
	}

	fs.readdir(path, function (error, files) {
		if (error) {
			return cb(error);
		}

		var result = [];

		async.forEachSeries(
			files,
			function (file, callback) {
				// skip hidden files and directories

				if (file[0] === '.') {
					return callback();
				}

				fs.stat(path + '/' + file, function (error, statInfo) {
					if (error) {
						return callback(error);
					}

					if (statInfo.isFile()) {
						if (matcher.test(file)) {
							getFileContents(path + '/' + file, function (error, data) {
								if (error) {
									return callback(error);
								}

								result.push(data);

								callback();
							});
						} else {
							callback();
						}
					} else if (statInfo.isDirectory()) {
						getFilesRecursive(path + '/' + file, matcher, glue, function (error, data) {
							if (error) {
								return callback(error);
							}

							result.push(data);

							callback();
						});
					} else {
						callback();
					}
				});
			},
			function (error) {
				if (error) {
					cb(error);
				} else {
					cb(null, result.join(glue));
				}
			}
		);
	});
}


function selfMergePage(output) {
	// selfMergePage lets the HTML embed its own CSS and/or JavaScript

	output.html = output.html.replace('$js(page)', function () {
		var js = output.js;
		output.js = '';
		return js;
	});

	output.html = output.html.replace('$css(page)', function () {
		var css = output.css;
		output.css = '';
		return css;
	});

	return output;
}


function getReplacementData(type, label, cb) {
	// if type is "cfg", we inject the configuration parameter

	if (type === 'cfg') {
		var value = mithril.getConfig(label);

		if (value === null) {
			mithril.core.logger.error('Tried to inject configuration value "' + label + '" into page, but failed. Injecting empty string instead.');
			value = '';
		}

		return cb(null, value);
	}

	// if label is "page", we want to include the page's own css/js, which we do at a later time

	if (label === 'page') {
		// we return the found hit, so nothing changes

		return cb(null, false);
	}

	// if label is "mithril.loader" and the type is "js", we embed the mithril loader

	if (label === 'mithril.loader' && type === 'js') {
		return getFileContents(__dirname + '/client-loader.js', cb);
	}

	// config lookup for a path

	var path = mithril.getConfig('module.mithrilui.paths.' + label);
	if (!path) {
		mithril.fatalError('Could not embed ' + type + ' ' + label + ' (path configuration missing).');
	}

	switch (type) {
	case 'js':
		getFilesRecursive(path, /\.js$/, '\n', cb);
		break;

	case 'css':
		getFilesRecursive(path, /\.(css|less)$/, '\n', cb);
		break;

	default:
		mithril.fatalError('No matching rule exists for filetype ' + type + '.');
		break;
	}
}


function embedReplacements(data, cb) {
	var matches = data.match(/\$(html|css|js)\(.+?\)/g);

	if (!matches || matches.length === 0) {
		return cb(null, data);
	}

	async.forEachSeries(
		matches,
		function (match, callback) {
			var m = /\$(html|css|js)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			getReplacementData(type, label, function (error, newdata) {
				if (error) {
					callback(error);
				} else {
					if (newdata !== false) {
						data = data.replace(match, function () {
							return newdata;
						});
					}

					callback();
				}
			});
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, data);
			}
		}
	);
}


function loadViewsFiles(views, filetype, cb) {
	var result = [];

	var viewBasePath = mithril.getConfig('module.mithrilui.paths.views');

	if (!viewBasePath) {
		mithril.fatalError('Embedding views, but no views path has been set in config: module.mithrilui.paths.views.');
	}

	async.forEachSeries(
		views,
		function (view, callback) {
			var viewPath = viewBasePath + '/' + view.viewClassName;
			var matcher;

			switch (filetype) {
			case 'html':
				matcher = /\.html$/;
				break;
			case 'css':
				matcher = /\.(css|less)$/;
				break;
			case 'js':
				matcher = /\.js$/;
				break;
			}

			if (!matcher) {
				return callback();
			}

			getFilesRecursive(viewPath, matcher, '\n', function (error, data) {
				if (error) {
					return callback(error);
				}

				if (filetype === 'html') {
					var key, attr = {}, div = '<div';

					if (view.cssClassNames) {
						div += ' class="view ' + view.cssClassNames.join(' ') + '"';
					} else {
						div += ' class="view"';
					}

					for (key in view.dataAttr) {
						div += ' data-' + key + '="' + view.dataAttr[key] + '"';
					}

					div += '>\n';

					result.push(div + data + '\n</div>\n');
				} else {
					result.push(data);
				}

				callback();
			});
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, result.join('\n'));
			}
		}
	);
}


function embedViews(data, views, cb) {
	var viewBasePath = mithril.getConfig('module.mithrilui.paths.views');

	if (!viewBasePath) {
		mithril.fatalError('Embedding views, but no views path has been set in config: module.mithrilui.paths.views.');
	}

	// find the placeholders

	var matches = data.match(/\$(html|js|css)\(page\.(views|viewsetup)\)/g);

	if (!matches || matches.length === 0) {
		return cb(null, data);
	}

	// find the requirements as dictated by the placeholders

	var required = { viewsetup: false, views: { html: false, css: false, js: false } };

	for (var i = 0, len = matches.length; i < len; i++) {
		var match = matches[i].match(/^\$(html|js|css)\(page\.(views|viewsetup)\)$/);
		var type = match[1];
		var label = match[2];

		if (label === 'viewsetup') {
			if (type === 'js') {
				required.viewsetup = true;
			}
		} else if (label === 'views') {
			required.views[type] = true;
		}
	}

	// render the required output

	async.waterfall([
		function (callback) {
			// view setup script

			if (!required.viewsetup) {
				return callback(null, data);
			}

			var str = [];

			for (var i = 0, len = views.length; i < len; i++) {
				var view = views[i];
				str.push("app.views.setViewHandler('" + view.viewName + "', new View" + view.viewClassName + "(app, app.views.getViewElement('" + view.viewName + "')));");
			}

			callback(null, data.replace('$js(page.viewsetup)', str.join('\n')));
		},
		function (data, callback) {
			// html

			if (!required.views.html) {
				return callback(null, data);
			}

			loadViewsFiles(views, 'html', function (error, viewdata) {
				if (error) {
					callback(error);
				} else {
					callback(null, data.replace('$html(page.views)', viewdata));
				}
			});
		},
		function (data, callback) {
			// css

			if (!required.views.css) {
				return callback(null, data);
			}

			loadViewsFiles(views, 'css', function (error, viewdata) {
				if (error) {
					callback(error);
				} else {
					callback(null, data.replace('$css(page.views)', viewdata));
				}
			});
		},
		function (data, callback) {
			// js

			if (!required.views.js) {
				return callback(null, data);
			}

			loadViewsFiles(views, 'js', function (error, viewdata) {
				if (error) {
					callback(error);
				} else {
					callback(null, data.replace('$js(page.views)', viewdata));
				}
			});
		}
	], cb);
}


function MuiPage(name, languages) {
	this.name = name;
	this.views = [];
	this.embed = {};
	this.languages = languages;
	this.minify = !!mithril.getConfig('module.mithrilui.delivery.page.js.minify');

	// page template:
	//   pages/$name/page.html
	//   pages/$name/script.js
	//   pages/$name/styles.css
	// will replace:
	//   $html(page.views) with the view html
	// will replace:
	//   $css(page.views) with the view css
	// will replace:
	//   $script(page.views) with the view js
	// will replace
	//   $script(page.viewsetup) with a view setup script
}


MuiPage.prototype.addView = function (viewClassName, viewName, cssClassNames, dataAttr) {
	if (dataAttr) {
		dataAttr.name = viewName;
	} else {
		dataAttr = { name: viewName };
	}

	this.views.push({ viewClassName: viewClassName, viewName: viewName, cssClassNames: cssClassNames, dataAttr: dataAttr });
};


function loadAndHandleFile(page, language, path, cb) {
	// based on file extension, will load the file data, and do all required replacements and optimizations

	// detect the file extension

	var filetype, ext;

	var match = path.match(/\.([a-z]+?)$/);
	if (match) {
		ext = match[1];

		switch (ext) {
		case 'html':
			filetype = 'html';
			break;
		case 'js':
			filetype = 'js';
			break;
		case 'css':
		case 'less':
			filetype = 'css';
			break;
		}
	}

	if (!filetype) {
		mithril.core.logger.error('Ignoring "' + path + '" of unrecognized file type.');
		return cb();
	}

	async.waterfall([
		function (callback) {
			getFileContents(path, callback);
		},
		function (data, callback) {
			embedViews(data, page.views, callback);
		},
		function (data, callback) {
			embedReplacements(data, callback);
		},
		function (data, callback) {
			if (filetype === 'js' || filetype === 'css') {
				data = mithril.assets.applyTranslationMap(data, language);
			}

			callback(null, data);
		},
		function (data, callback) {
			if (filetype === 'js' && page.minify) {
				var uglify = require('uglify-js');

				var ast = uglify.parser.parse(data);
				ast = uglify.uglify.ast_mangle(ast);
				ast = uglify.uglify.ast_squeeze(ast);
				data = uglify.uglify.gen_code(ast);
			}

			callback(null, filetype, data);
		}
	], cb);
}


MuiPage.prototype.render = function (language, cb) {
	// returns { html: '', css: '', js: '' }

	mithril.core.logger.debug('Rendering page "' + this.name + '" in language "' + language + '"');

	var pagesPath = mithril.getConfig('module.mithrilui.paths.pages');
	if (!pagesPath) {
		mithril.fatalError('Pages path configuration missing.');
	}

	var pagePath = pagesPath + '/' + this.name;
	var page = this;

	fs.readdir(pagePath, function (error, files) {
		if (error) {
			return cb(error);
		}

		var output = { html: '', css: '', js: '' };

		async.forEachSeries(
			files,
			function (file, callback) {
				loadAndHandleFile(page, language, pagePath + '/' + file, function (error, filetype, data) {
					if (error) {
						callback(error);
					} else {
						if (data) {
							output[filetype] = data;
						}

						callback();
					}
				});
			},
			function (error) {
				if (error) {
					return cb(error);
				}

				output = selfMergePage(output);

				cb(null, output);
			}
		);
	});
};


exports.MuiPage = MuiPage;


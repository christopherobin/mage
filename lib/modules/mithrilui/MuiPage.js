var fs = require('fs'),
    async = require('async'),
    less = require('less'),
    mithril = require('../../mithril');


var buildPaths = {};


exports.registerBuildPath = function (ident, fullPath) {
	buildPaths[ident] = fullPath;
};


// set up an include path for mithril ui's loader script

exports.registerBuildPath('mithril.mithrilui.loader', __dirname + '/loader');
exports.registerBuildPath('mithril.mithrilui.phonegap.wizAssetsHandler', __dirname + '/phonegap/wizAssetsHandler');


function parseCssWithLess(path, data, minify, cb) {
	mithril.core.logger.debug('Parsing CSS contents through "less".');

	var options = {};

	if (path) {
		options.paths = [path];
	}

	var parser = new less.Parser(options);

	parser.parse(data, function (error, tree) {
		if (error) {
			mithril.core.logger.error(error);
			return cb(error);
		}

		var cssData = tree.toCSS({ compress: !!minify });

		cb(null, cssData);
	});
}


function getFileContents(path, cb) {
	mithril.core.logger.debug('Loading contents from: ' + path);

	fs.readFile(path, 'utf8', cb);
}


function readDirectory(path, matcher, cb) {
	// returns: { files: [], directories: [] } containing relative paths

	fs.readdir(path, function (error, entries) {
		if (error) {
			return cb(error);
		}

		var result = { files: [], directories: [] };

		async.forEachSeries(
			entries,
			function (entry, callback) {
				// skip hidden files

				if (entry[0] === '.') {
					return callback();
				}

				fs.stat(path + '/' + entry, function (error, statInfo) {
					if (statInfo.isDirectory()) {
						result.directories.push(entry);
					} else if (statInfo.isFile()) {
						// skip files that do not match the matcher

						if (!matcher || entry.match(matcher)) {
							result.files.push(entry);
						}
					}

					callback();
				});
			},
			function (error) {
				if (error) {
					cb(error);
				} else {
					cb(null, result);
				}
			}
		);
	});
}


function getFilesRecursive(path, matcher, glue, cb) {
	mithril.core.logger.debug('Reading entire directory structure "' + path + '", using matcher: ' + matcher);

	if (typeof glue !== 'string') {
		glue = '';
	}

	readDirectory(path, matcher, function (error, entries) {
		if (error) {
			return cb(error);
		}

		var tasks = [];

		// first read files

		entries.files.forEach(function (file) {
			tasks.push(function (callback) {
				getFileContents(path + '/' + file, callback);
			});
		});

		// next, directories

		entries.directories.forEach(function (dir) {
			tasks.push(function (callback) {
				getFilesRecursive(path + '/' + dir, matcher, glue, callback);
			});
		});

		// execute the reads and return the glued together result

		async.series(
			tasks,
			function (error, contents) {
				if (error) {
					cb(error);
				} else {
					cb(null, contents.join(glue));
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


function getReplacementData(page, type, label, cb) {
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

	// set up a file extension matcher regexp based on type

	var fileMatcher, fileSplitter = '';

	switch (type) {
	case 'js':
		fileMatcher = /\.js$/;
		fileSplitter = '\n';
		break;
	case 'css':
		fileMatcher = /\.(css|less)$/;
		fileSplitter = '\n';
		break;
	default:
		mithril.fatalError('No matching rule exists for filetype ' + type + '.');
		return;
	}


	var path;

	if (label in buildPaths) {
		// specially registered build paths (such as the mithrilui loader script, and other plugins)

		path = buildPaths[label];
	} else if (label.match('mithril.client.')) {
		var m = label.match(/^mithril\.client\.([a-zA-Z0-9]+)$/);
		if (m) {
			path = mithril.core.clients.getPath(m[1]);
		}
	} else {
		// last chance: config lookup for a path

		path = mithril.getConfig('module.mithrilui.paths.' + label);
	}

	if (path) {
		getFilesRecursive(path, fileMatcher, fileSplitter, function (error, data) {
			if (error) {
				return cb(error);
			}

			embedReplacements(page, data, cb);
		});
	} else {
		mithril.fatalError('Could not embed ' + type + ' ' + label + ' (unknown target).');
	}
}


function embedReplacements(page, data, cb) {
	var matches = data.match(/\$(cfg|html|css|js)\(.+?\)/g);

	if (!matches || matches.length === 0) {
		return cb(null, data);
	}

	async.forEachSeries(
		matches,
		function (match, callback) {
			var m = /\$(cfg|html|css|js)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			getReplacementData(page, type, label, function (error, newdata) {
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
						div += ' class="view view' + view.viewClassName + ' ' + view.cssClassNames.join(' ') + '"';
					} else {
						div += ' class="view view' + view.viewClassName + '"';
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
	var cfg = mithril.getConfig('module.mithrilui.delivery.page');

	this.name = name;
	this.views = [];
	this.embed = {};
	this.languages = languages;
	this.minifyJs = cfg && cfg.js && cfg.js.minify;
	this.minifyCss = cfg && cfg.css && cfg.css.minify;
	this.cssParser = (cfg && cfg.css) ? (cfg.css.parser || null) : null;

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


var extensionMap = {
	'html': 'html',
	'js': 'js',
	'css': 'css',
	'less': 'css'
};


function loadAndHandlePage(page, language, path, cb) {
	// this function is run for the files in the page's root directory
	// based on file extension, will load the file data, and do all required replacements on the contents and subcontents
	// finally, it will apply optimizations, compression, etc.

	var filetype;

	async.waterfall([
		function (callback) {
			loadAndHandleFile(page, path, callback);
		},
/*
		function (filetype, data, callback) {
			if (filetype === 'html' || filetype === 'css') {
				data = mithril.assets.applyTranslationMap(data, language);
			}

			callback(null, data);
		},
*/
		function (detectedFiletype, data, callback) {
			filetype = detectedFiletype;

			if (filetype === 'js' && page.minifyJs) {
				var uglify = require('uglify-js');

				var ast = uglify.parser.parse(data);
				ast = uglify.uglify.ast_mangle(ast);
				ast = uglify.uglify.ast_squeeze(ast);
				data = uglify.uglify.gen_code(ast);
			}

			callback(null, data);
		},
		function (data, callback) {
			if (filetype === 'css' && (page.minifyCss || page.cssParser === 'less')) {
				parseCssWithLess(require('path').dirname(path), data, page.minifyCss, callback);
			} else {
				callback(null, data);
			}
		}
	],
	function (error, data) {
		if (error) {
			return cb(error);
		}

		cb(null, filetype, data);
	});
}


function loadAndHandleFile(page, path, cb) {
	// detect the file extension

	var filetype;

	var match = path.match(/\.([a-z]+?)$/);
	if (match) {
		filetype = extensionMap[match[1]];
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
			embedReplacements(page, data, callback);
		},
	],
	function (error, data) {
		if (error) {
			return cb(error);
		}

		cb(null, filetype, data);
	});
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

		console.log('Rendering', files);

		var output = { html: '', css: '', js: '' };

		async.forEachSeries(
			files,
			function (file, callback) {
				loadAndHandlePage(page, language, pagePath + '/' + file, function (error, filetype, data) {
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


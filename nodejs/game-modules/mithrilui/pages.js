var fs = require('fs');

var pages = {};

exports.Page = function(name, basePath, viewPath)
{
	this.name = name;
	this.views = [];
	this.embed = {};

	// page template:
	//   basePath/$name/page.html
	//   basePath/$name/script.js
	//   basePath/$name/styles.css
	// will replace:
	//   $html(page.views) with the view html
	// will replace:
	//   $css(page.views) with the view css
	// will replace:
	//   $script(page.views) with the view js
	// will replace
	//   $script(page.viewsetup) with a view setup script

	this.addView = function(viewClassName, viewName, cssClassNames, dataAttr)
	{
		this.views.push({ viewClassName: viewClassName, viewName: viewName, cssClassNames: cssClassNames, dataAttr: dataAttr });
	};


	this.embedScripts = function(label, path, matcher)
	{
		// will replace $(script.label) with all matched files in path

		this.embed['script(' + label + ')'] = { path: path, matcher: matcher };
	};


	this.embedStyles = function(label, path, matcher)
	{
		// will replace $(styles.label) with all matches files in path

		this.embed['css(' + label + ')'] = { path: path, matcher: matcher };
	};


	this.render = function()
	{
		// returns { html: '', css: '', js: '' }

		var html = getFileContents(basePath + '/' + name + '/page.html');
		var js   = getFileContents(basePath + '/' + name + '/script.js');
		var css  = getFileContents(basePath + '/' + name + '/styles.css');

		html = embedViews(html);
		js   = embedViews(js);
		css  = embedViews(css);

		html = embedReplacements(html);
		js   = embedReplacements(js);
		css  = embedReplacements(css);

		return { html: html, js: js, css: css };
	};


	var _this = this;

	function embedReplacements(file)
	{
		return file.replace(/\$(script|css)\(.+?\)/g, function(match) {

			var m = /\$(script|css)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			var embed = _this.embed[type + '(' + label + ')'];
			if (!embed)
			{
				mithril.core.logger.error('Could not embed ' + type + ' ' + label);
				return '';
			}

			return mergeFiles(embed.path, embed.matcher || /\.js$/);
		});
	}

	function embedViews(file)
	{
		return file.replace(/\$(html|script|css)\(.+?\)/g, function(match) {

			var m = /\$(html|script|css)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			if (label !== 'page.views' && label !== 'page.viewsetup')
			{
				// not a view-replacement

				return match;
			}

			var str = [];

			var len = _this.views.length;
			for (var i=0; i < len; i++)
			{
				var view = _this.views[i];

				switch (type)
				{
					case 'html':
						var attr = {};

						attr['class'] = view.cssClassNames ? ('view ' + view.cssClassNames.join(' ')) : 'view';

						for (var key in view.dataAttr)
						{
							attr['data-' + key] = view.dataAttr[key];
						}

						var div = '<div';
						for (var key in attr)
						{
							div += ' ' + key + '="' + attr[key] + '"';
						}
						div += '>\n';

						str.push(div + getFileContents(viewPath + '/' + view.viewClassName + '/view.html') + '\n</div>\n');
						break;

					case 'script':
						str.push(getFileContents(viewPath + '/' + view.viewClassName + '/script.js'));
						break;

					case 'css':
						str.push(getFileContents(viewPath + '/' + view.viewClassName + '/styles.css'));
						break;
				}
			}

			return str.join('\n');
		});
	}
};


function mergeFiles(path, matcher)
{
	return getFilesRecursive(path, matcher).join('\n');
}


function getFilesRecursive(path, matcher)
{
	var result = [];

	var files = fs.readdirSync(path);
	var len = files.length;

	for (var i=0; i < len; i++)
	{
		var file = files[i];

		var stat = fs.statSync(path + '/' + file);

		if (stat.isFile())
		{
			if (matcher.test(file))
			{
				result.push(getFileContents(path + '/' + file));
			}
		}
		else if (stat.isDirectory())
		{
			// if the file is a directory, recursively go through it

			var children = getFilesRecursive(path + '/' + file, matcher);
			if (children.length > 0)
			{
				result = result.concat(children);
			}
		}
	}

	return result;
}


function getFileContents(path)
{
	return fs.readFileSync(path, 'utf8')
}


/*
exports.addPageFileMerge = function(name, path, htmlMatch, cssMatch, jsMatch)
{
	// loops recursively through path, and merges all files it finds that match the given matchers

	if (!htmlMatch) htmlMatch = /\.html?$/;
	if (!cssMatch)  htmlMatch = /\.css$/;
	if (!jsMatch)   htmlMatch = /\.js$/;

	var page = { html: '', css: '', js: '' };

	page.html = getFilesRecursive(path, htmlMatch).join('\n');
	page.css  = getFilesRecursive(path, cssMatch).join('\n');
	page.js   = getFilesRecursive(path, jsMatch).join('\n');

	pages[name] = page;
};
*/

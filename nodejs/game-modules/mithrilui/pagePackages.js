var fs = require('fs');

//var pages = {};

exports.PagePackage = function(name, packagePath, viewPath)
{
	this.name = name;
	this.views = [];
	this.embed = {};

	// page template:
	//   packagePath/$name/page.html
	//   packagePath/$name/script.js
	//   packagePath/$name/styles.css
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
		if (dataAttr)
			dataAttr.name = viewName;
		else
			dataAttr = { name: viewName };

		this.views.push({ viewClassName: viewClassName, viewName: viewName, cssClassNames: cssClassNames, dataAttr: dataAttr });
	};


	this.embedScripts = function(label, path, matcher)
	{
		// will replace $(script.label) with all matched files in path

		this.embed['js(' + label + ')'] = { path: path, matcher: matcher };
	};


	this.embedStyles = function(label, path, matcher)
	{
		// will replace $(styles.label) with all matches files in path

		this.embed['css(' + label + ')'] = { path: path, matcher: matcher };
	};


	this.render = function(img, language)
	{
		// returns { html: '', css: '', js: '' }

		var html = getFileContents(packagePath + '/' + name + '/page.html');
		var js   = getFileContents(packagePath + '/' + name + '/script.js');
		var css  = getFileContents(packagePath + '/' + name + '/styles.css');

		html = embedViews(html);
		js   = embedViews(js);
		css  = embedViews(css);

		html = embedReplacements(html);
		js   = embedReplacements(js);
		css  = embedReplacements(css);

		if (img)
		{
			html = img.applyTranslationMap(html, language);
			css  = img.applyTranslationMap(css, language);
		}

		return { html: html, js: js, css: css };
	};


	var _this = this;

	function embedReplacements(file)
	{
		return file.replace(/\$(js|css)\(.+?\)/g, function(match) {

			var m = /\$(js|css)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			var embed = _this.embed[type + '(' + label + ')'];
			if (!embed)
			{
				mithril.core.logger.error('Could not embed ' + type + ' ' + label);
				return '';
			}

			var matcher = embed.matcher;
			if (!matcher)
			{
				switch (type)
				{
					case 'js':  matcher = /\.js$/; break;
					case 'css': matcher = /\.css$/; break;
				}
			}

			if (!matcher)
			{
				mithril.core.logger.error('No matching rule found for filetype ' + type);
			}

			return mergeFiles(embed.path, matcher);
		});
	}


	function embedViews(file)
	{
		return file.replace(/\$(html|js|css)\(.+?\)/g, function(match) {

			var m = /\$(html|js|css)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			if (label !== 'package.views' && label !== 'package.viewsetup')
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

					case 'js':
						if (label === 'package.viewsetup')
						{
							str.push("app.views.setViewHandler('" + view.viewName + "', new View" + view.viewClassName + "(app, app.views.getViewElement('" + view.viewName + "')));");
						}
						else
						{
							str.push(getFileContents(viewPath + '/' + view.viewClassName + '/script.js'));
						}
						break;

					case 'css':
						var path = viewPath + '/' + view.viewClassName + '/styles.css';

						try
						{
							var contents = getFileContents(path);
							str.push(contents);
						}
						catch (e)
						{
						}
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

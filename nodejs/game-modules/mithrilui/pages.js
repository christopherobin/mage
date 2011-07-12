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
	//   $(page.views.html) with the view html
	// will replace:
	//   $(page.views.css) with the view css
	// will replace:
	//   $(page.views.js) with the view js

	this.addView = function(viewClassName, viewName, cssClassNames, dataAttr)
	{
		this.views.push({ viewClassName: viewClassName, viewName: viewName, cssClassNames: cssClassNames, dataAttr: dataAttr });
	};


	this.embedScripts = function(label, path, matcher)
	{
		// will replace $(script.label) with all matched files in path

		this.embed['script.' + label] = { path: path, matcher: matcher };
	};


	this.embedStyles = function(label, path, matcher)
	{
		// will replace $(styles.label) with all matches files in path

		this.embed['styles.' + label] = { path: path, matcher: matcher };
	};


	this.render = function()
	{
		// returns { html: '', css: '', js: '' }

		var html = getFileContents(basePath + '/' + name + '/page.html');
		var js   = getFileContents(basePath + '/' + name + '/script.js');
		var css  = getFileContents(basePath + '/' + name + '/styles.css');

		var files = [html, js, css];

		var _this = this;

		files = files.map(function(file) {
			return file.replace(/\$\((script|styles)\..+?\)/g, function(match) {
				var label = match.substring(2, match.length - 2);
				var embed = _this.embed[label];

				return mergeFiles(embed.path, embed.matcher || /\.js$/);
			});
		});

		return { html: files[0], js: files[1], css: files[2] };
	};
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

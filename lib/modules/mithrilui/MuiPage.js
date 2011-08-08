var fs = require('fs');


function MuiPage(name, languages)
{
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

	this.addView = function(viewClassName, viewName, cssClassNames, dataAttr)
	{
		if (dataAttr)
			dataAttr.name = viewName;
		else
			dataAttr = { name: viewName };

		this.views.push({ viewClassName: viewClassName, viewName: viewName, cssClassNames: cssClassNames, dataAttr: dataAttr });
	};


	this.render = function(language)
	{
		// returns { html: '', css: '', js: '' }

		mithril.core.logger.debug('Rendering page "' + name + '" in language "' + language + '"');

		var pagesPath = mithril.getConfig('module.mithrilui.paths.pages');
		if (!pagesPath)
		{
			mithril.core.logger.error('Pages path configuration missing.');
			return false;
		}

		var pagePath = pagesPath + '/' + name;

		var html = getFileContents(pagePath + '/page.html');
		var js   = getFileContents(pagePath + '/script.js');
		var css  = getFileContents(pagePath + '/styles.css');

		html = embedViews(html);
		js   = embedViews(js);
		css  = embedViews(css);

		html = embedReplacements(html);
		js   = embedReplacements(js);
		css  = embedReplacements(css);

		html = mithril.assets.applyTranslationMap(html, language);
		css  = mithril.assets.applyTranslationMap(css, language);

		if (js && this.minify)
		{
			var uglify = require('uglify-js');
			var ast = uglify.parser.parse(js);
			ast = uglify.uglify.ast_mangle(ast);
			ast = uglify.uglify.ast_squeeze(ast);
			js = uglify.uglify.gen_code(ast);
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

			// config lookup for a path

			var path = mithril.getConfig('module.mithrilui.paths.' + label);
			if (!path)
			{
				mithril.core.logger.error('Could not embed ' + type + ' ' + label + ' (path configuration missing)');
				return '';
			}

			switch (type)
			{
				case 'js':
					return mergeFiles(path, /\.js$/);

				case 'css':
					return mergeFiles(path, /\.css$/);
			}

			mithril.core.logger.error('No matching rule exists for filetype ' + type);
			return '';
		});
	}


	function embedViews(file)
	{
		return file.replace(/\$(html|js|css)\(.+?\)/g, function(match) {

			var m = /\$(html|js|css)\((.+?)\)/.exec(match);

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

				var viewPath = mithril.core.config.module.mithrilui.paths.views + '/' + view.viewClassName;

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

						str.push(div + getFileContents(viewPath + '/view.html') + '\n</div>\n');
						break;

					case 'js':
						if (label === 'page.viewsetup')
						{
							str.push("app.views.setViewHandler('" + view.viewName + "', new View" + view.viewClassName + "(app, app.views.getViewElement('" + view.viewName + "')));");
						}
						else
						{
							str.push(getFileContents(viewPath + '/script.js'));
						}
						break;

					case 'css':
						try
						{
							var contents = getFileContents(viewPath + '/styles.css');
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


module.exports = MuiPage;



function mergeFiles(path, matcher)
{
	return getFilesRecursive(path, matcher).join('\n');
}


function getFilesRecursive(path, matcher)
{
	var result = [];

	var files = fs.readdirSync(path);

	for (var i=0, len = files.length; i < len; i++)
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


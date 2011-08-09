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

		var output = {
			html: getFileContents(pagePath + '/page.html'),
			js:   getFileContents(pagePath + '/script.js'),
			css:  getFileContents(pagePath + '/styles.css')
		};

		output.html = embedViews(output.html);
		output.js   = embedViews(output.js);
		output.css  = embedViews(output.css);

		output.html = embedReplacements(output.html);
		output.js   = embedReplacements(output.js);
		output.css  = embedReplacements(output.css);

		output.html = mithril.assets.applyTranslationMap(output.html, language);
		output.css  = mithril.assets.applyTranslationMap(output.css, language);

		if (output.js && this.minify)
		{
			var uglify = require('uglify-js');
			var ast = uglify.parser.parse(output.js);
			ast = uglify.uglify.ast_mangle(ast);
			ast = uglify.uglify.ast_squeeze(ast);
			output.js = uglify.uglify.gen_code(ast);
		}

		output = selfMergePage(output);

		return output;
	};


	var _this = this;

	function selfMergePage(output)
	{
		// selfMergePage lets the HTML embed its own CSS and/or JavaScript

		output.html = output.html.replace('$js(page)', function() {
			var js = output.js;
			output.js = '';
			return js;
		});

		output.html = output.html.replace('$css(page)', function() {
			var css = output.css;
			output.css = '';
			return css;
		});

		return output;
	}


	function embedReplacements(file)
	{
		return file.replace(/\$(js|css|cfg)\(.+?\)/g, function(match) {

			var m = /\$(js|css|cfg)\((.+?)\)/.exec(match);

			var type = m[1];
			var label = m[2];

			// if type is "cfg", we inject the confiration parameter

			if (type === 'cfg')
			{
				console.log(label);
				console.log(mithril.getConfig(label));

				return mithril.getConfig(label);
			}

			// if label is "page", we want to include the page's own css/js, which we do at a later time

			if (label === 'page')
			{
				// we return the found hit, so nothing changes

				return match;
			}

			// if label is "mithril.loader" and the type is "js", we embed the mithril loader

			if (label === 'mithril.loader' && type === 'js')
			{
				return getFileContents(__dirname + '/client-loader.js');
			}

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
	try
	{
		return fs.readFileSync(path, 'utf8');
	}
	catch (e)
	{
		mithril.core.logger.error('Could not open ' + path);
		return '';
	}
}

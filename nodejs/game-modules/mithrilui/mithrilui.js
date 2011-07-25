//exports.viewport = require(__dirname + '/viewport.js');

var fs = require('fs');

var loaderPage;
var pages = {};

exports.img      = require(__dirname + '/img.js');
exports.pages    = require(__dirname + '/pages.js');
exports.pagePackages = require(__dirname + '/pagePackages.js');

exports.setup = function(state, cb)
{
	loaderPage = fs.readFileSync(__dirname + '/loader.html', 'utf8');

	setupRoutes(cb);
};


exports.addPage = function(name)
{
	var page = new exports.pages.Page(name);
	pages[name] = page;
	return page;
};


function setupRoutes(cb)
{
	mithril.addRoute(/^\/page\//, function(request, path, params, cb) {

		// requested path can be:
		// page
		//   eg: /page/game
		// package:
		//   eg: /page/game/landing

		path = path.substring(6).split('/').filter(function(elm) { return elm; });	// drop /page/ and split the path into its elements

		if (!path || path.length == 0)
		{
			return cb(false);
		}

		var pageName = path[0];

		switch (path.length)
		{
			case 1:
				// a page request, so we return the loader
				// eg: /page/game

				var manifestUrl = '/page/' + pageName + '/page.manifest';

				var output = loaderPage.replace('mui://manifest', manifestUrl).replace('mui.imageMapProvider', "JSON.parse('" + JSON.stringify(exports.img.getTranslationMap(params.language)) + "')");

				cb(200, output, { 'Content-Type': 'text/html; charset=utf8' });
				break;

			case 2:
				// a page's package or a manifest
				// eg: /page/game/page.manifest
				// eg: /page/game/main

				var page = pages[pageName];

				if (!page)
				{
					return cb(false);
				}

				var fileName = path[1];

				if (fileName === 'page.manifest')
				{
					// return the manifest

					cb(200, page.getManifest(exports.img, params.language), { 'Content-Type': 'text/cache-manifest' });
				}
				else
				{
					// return a package

					var pckg = page.getPackage(fileName);
					if (!pckg)
					{
						return cb(false);
					}

					pckg = pckg.render();

					var output = [];

					if (pckg.html)
					{
						output.push('text/html\n' + pckg.html);
					}

					if (pckg.js)
					{
						output.push('text/javascript\n' + pckg.js);
					}

					if (pckg.css)
					{
						output.push('text/css\n' + pckg.css);
					}

					cb(200, output.join(params.partSplit), { 'Content-Type': 'text/plain; charset=utf8' });
				}
				break;
		}
	});

	cb();
};


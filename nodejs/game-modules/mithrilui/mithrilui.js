//exports.viewport = require(__dirname + '/viewport.js');

var fs = require('fs');

var loaderPage;
var packages = {};

exports.img        = require(__dirname + '/img.js');
exports.MuiPackage = require(__dirname + '/MuiPackage.js');
exports.MuiPage    = require(__dirname + '/MuiPage.js');


exports.setup = function(state, cb)
{
	loaderPage = fs.readFileSync(__dirname + '/loader.html', 'utf8');

	setupRoutes(cb);
};


exports.addPackage = function(name)
{
	return (packages[name] = new exports.MuiPackage(name));
};


function setupRoutes(cb)
{
	mithril.addRoute(/^\/mui\//, function(request, path, params, cb) {

		// requested path can be:
		// package
		//   eg: /mui/game
		// page in a package:
		//   eg: /mui/game/landing

		path = path.substring(5).split('/').filter(function(elm) { return elm; });	// drop /page/ and split the path into its elements

		if (!path || path.length == 0)
		{
			return cb(false);
		}

		var packageName = path[0];

		switch (path.length)
		{
			case 1:
				// a package request, so we return the loader
				// eg: /mui/game

				var manifestUrl = '/mui/' + packageName + '/package.manifest?language=' + (params.language || '');

				output = loaderPage.replace('mui://manifest', manifestUrl);

				cb(200, output, { 'Content-Type': 'text/html; charset=utf8' });
				break;

			case 2:
				// a package's page or a manifest
				// eg: /mui/game/package.manifest
				// eg: /mui/game/main

				var pckg = packages[packageName];

				if (!pckg)
				{
					mithril.core.logger.debug('Package ' + packageName + ' not found.');
					return cb(false);
				}

				var fileName = path[1];

				if (fileName === 'package.manifest')
				{
					// return the manifest

					cb(200, pckg.manifest.get(params.language), { 'Content-Type': 'text/cache-manifest' });
				}
				else
				{
					// return a page

					var page = pckg.getPage(fileName);
					if (!page)
					{
						mithril.core.logger.debug('Page ' + fileName + ' not found.');
						return cb(false);
					}

					page = page.render(exports.img, params.language);

					var output = [];

					if ('imagemap' in params)
					{
						output.push('mui/imagemap\n' + JSON.stringify(exports.img.getTranslationMap(params.imagemap)));
					}

					if (page.html)
					{
						output.push('text/html\n' + page.html);
					}

					if (page.js)
					{
						output.push('text/javascript\n' + page.js);
					}

					if (page.css)
					{
						output.push('text/css\n' + page.css);
					}

					cb(200, output.join(params.partSplit), { 'Content-Type': 'text/plain; charset=utf8' });
				}
				break;
		}
	});

	cb();
};


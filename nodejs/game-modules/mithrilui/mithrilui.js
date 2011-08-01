//exports.viewport = require(__dirname + '/viewport.js');

var fs = require('fs');

var loaderPage;
var packages = {};
var pagePartSplitString = '---page-part---';

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

					// for caching purposes (client and server) the unique key is: pckg, fileName (page), language, assetmap included y/n
					// if params.hash matches a known hash for this combination of parameters, we return an indicator for "no changes".

					getPageOutput(pckg, fileName, params.language, 'assetmap' in params, params.hash, function(error, output, headers) {
						if (error) { return cb(false); }

						cb(200, output, headers);
					});
				}
				break;
		}
	});

	cb();
};


var pageCache = {};


function getPageOutput(pckg, pageName, language, incAssetMap, hash, cb)
{
	var cacheKey = pckg.name + ',' + pageName + ',' + language + ',' + (incAssetMap ? '1' : '0');

	// try to use a cached version, or if the client's local cache matches ours, we tell the client to use their local cache

	var cached = pageCache[cacheKey];

	if (cached)
	{
		console.log('Using cached page ' + cacheKey);

		if (hash && cached.hash === hash)
		{
			return cb(null, 'usecache', { 'Content-Type': 'text/plain; charset=utf8' });
		}
		else
		{
			return cb(null, cached.output, cached.headers);
		}
	}

	// request not yet available in our server cache, so we generate it

	var page = pckg.getPage(pageName);
	if (!page)
	{
		mithril.core.logger.error('Page "' + fileName + '" not found.');
		return cb(true);
	}

	page = page.getOutput(language);
	if (!page)
	{
		mithril.core.logger.error('Failed to retrieve page output for "' + pageName + '" in language "' + language + '"');
		return cb(true);
	}

	var output = [];

	if (incAssetMap)
	{
		output.push('mui/assetmap\n' + JSON.stringify(mithril.assets.getTranslationMap(language)));
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


	// base output buffer and headers

	output = new Buffer(output.join(pagePartSplitString));

	var headers = { 'Content-Type': 'text/plain; charset=utf8', 'X-MithrilUI-PartSplit': pagePartSplitString };


	// compression

	if (mithril.getConfig('module.mithrilui.delivery.page.compress'))
	{
		var gzip = require('compress-buffer');

		mithril.core.logger.debug('Page ' + cacheKey + ' size before gzip compression: ' + output.length + ' bytes.');

		output = gzip.compress(output);

		mithril.core.logger.debug('Page ' + cacheKey + ' size after gzip compression: ' + output.length + ' bytes.');

		headers['Content-Encoding'] = 'gzip';
	}
	else
	{
		mithril.core.logger.debug('Page ' + cacheKey + ' size: ' + output.length + ' bytes.');
	}

	// output hash

	var hash = require('crypto').createHash('md5').update(output).digest('hex');

	headers['X-MithrilUI-Hash'] = hash;

	// respond to the client

	cb(null, output, headers);

	// add this generated page to the page cache

	mithril.core.logger.debug('Adding page to cache: ' + cacheKey);

	pageCache[cacheKey] = {
		hash: hash,
		output: output,
		headers: headers
	};
}


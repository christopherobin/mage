var mithril = require('../../mithril.js'),
    fs = require('fs'),
	crypto = require('crypto');


var packages = {};
var pagePartSplitString = '---page-part---';
var fileCache = {};
var usePageCache = false;
var useManifest = false;
var compressPages = false;


exports.MuiPackage = require(__dirname + '/MuiPackage.js');
exports.MuiPage    = require(__dirname + '/MuiPage.js');


exports.setup = function(state, cb)
{
	usePageCache  = !!mithril.getConfig('module.mithrilui.delivery.page.serverCache');
	compressPages = !!mithril.getConfig('module.mithrilui.delivery.page.compress');
	useManifest   = !!mithril.getConfig('module.mithrilui.delivery.package.useManifest');

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

				getLoaderPageOutput(packageName, params.language, function(error, result) {
					if (error) { return cb(false); }

					cb(200, result.output, result.headers);
				});
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

					getManifestOutput(pckg, params.language, function(error, result) {
						if (error) { return cb(false); }

						cb(200, result.output, result.headers);
					});
				}
				else
				{
					// return a page

					// for caching purposes (client and server) the unique key is: pckg, fileName (page), language, assetmap included y/n
					// if params.hash matches a known hash for this combination of parameters, we return an indicator for "no changes".

					getPageOutput(pckg, fileName, params.language, 'assetmap' in params, params.hash, function(error, result) {
						if (error) { return cb(false); }

						cb(200, result.output, result.headers);
					});
				}
				break;
		}
	});

	cb();
};


function getLoaderPageOutput(packageName, language, cb)
{
	language = language || '';

	var cacheKey = 'loader:' + packageName + ',' + language;

	// check file cache

	var cached = getCachedFile(cacheKey, null);
	if (cached)
	{
		return cb(null, cached);
	}

	// load the loader HTML and set up headers

	var headers = { 'Content-Type': 'text/html; charset=utf8' };
	var output = fs.readFileSync(__dirname + '/loader.html', 'utf8');

	// inject manifest or empty string

	output = output.replace('mui://manifest', function() {
		if (useManifest)
			return '/mui/' + packageName + '/package.manifest?language=' + language;

		return '';
	});

	var result = prepareFileOutput(cacheKey, output, headers, false);

	// return the response information

	cb(null, result);
}


function getManifestOutput(pckg, language, cb)
{
	language = language || '';

	var cacheKey = 'manifest:' + pckg.name + ',' + language;

	var cached = getCachedFile(cacheKey, null);
	if (cached)
	{
		return cb(null, cached);
	}

	var output = pckg.manifest.get(language);
	var headers = { 'Content-Type': 'text/cache-manifest' };

	var result = prepareFileOutput(cacheKey, output, headers, false);

	// return the response information

	cb(null, result);
}


function getPageOutput(pckg, pageName, language, incAssetMap, hash, cb)
{
	language = language || '';

	var cacheKey = pckg.name + ',' + pageName + ',' + language + ',' + (incAssetMap ? '1' : '0');

	// try to use a cached version, or if the client's local cache matches ours, we tell the client to use their local cache

	if (usePageCache)
	{
		var cached = getCachedFile(cacheKey, hash);
		if (cached)
		{
			return cb(null, cached);
		}
	}

	// request not yet available in our server cache, so we generate it

	var page = pckg.getPage(pageName);
	if (!page)
	{
		mithril.core.logger.error('Page "' + fileName + '" not found.');
		return cb(true);
	}

	page = page.render(language);
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

	var headers = {
		'Content-Type': 'text/plain; charset=utf8',
		'X-MithrilUI-PartSplit': pagePartSplitString
	};

	var result = prepareFileOutput(cacheKey, output, headers, true);

	// return the response information

	cb(null, result);
}


function getCachedFile(cacheKey, hash)
{
	var cached = fileCache[cacheKey];
	if (cached)
	{
		console.log('Using cached file ' + cacheKey);

		if (hash && cached.hash === hash)
		{
			return { output: 'usecache', headers: { 'Content-Type': 'text/plain; charset=utf8' } };
		}

		return cached;
	}

	return null;
}


function prepareFileOutput(cacheKey, output, headers, createHash)
{
	// make sure we are using a Buffer object

	if (!(output instanceof Buffer))
	{
		output = new Buffer(output);
	}

	// create result object

	var result = {
		output: output,
		headers: headers
	};

	// GZIP compression

	if (compressPages)
	{
		var gzip = require('compress-buffer');

		mithril.core.logger.debug('File ' + cacheKey + ' size before gzip compression: ' + result.output.length + ' bytes.');

		result.output = gzip.compress(result.output);

		mithril.core.logger.debug('File ' + cacheKey + ' size after gzip compression: ' + result.output.length + ' bytes.');

		result.headers['Content-Encoding'] = 'gzip';
	}
	else
	{
		mithril.core.logger.debug('File ' + cacheKey + ' size: ' + result.output.length + ' bytes.');
	}

	// generate MD5 hash

	if (createHash)
	{
		result.hash = crypto.createHash('md5').update(output).digest('hex');

		result.headers['X-MithrilUI-Hash'] = result.hash;
	}

	// add this generated page to the page cache

	if (usePageCache)
	{
		mithril.core.logger.debug('Adding file to cache: ' + cacheKey);

		fileCache[cacheKey] = result;
	}

	return result;
}


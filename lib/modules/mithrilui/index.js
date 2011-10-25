var mithril = require('../../mithril'),
    fs = require('fs'),
	crypto = require('crypto'),
	Buffer = require('buffer').Buffer,
	MuiPackage = require('./MuiPackage').MuiPackage,
	MuiPage = require('./MuiPage').MuiPage;


exports.MuiPackage = MuiPackage;
exports.MuiPage    = MuiPage;


var packages = {};
var pagePartSplitString = '---page-part---';
var fileCache = {};
var usePageCache = false;
var useManifest = false;
var compressPages = false;


exports.addPackage = function (name) {
	var pckg = new MuiPackage(name);

	packages[name] = pckg;

	return pckg;
};


function getCachedFile(cacheKey, hash) {
	var cached = fileCache[cacheKey];
	if (cached) {
		console.log('Using cached file ' + cacheKey);

		if (hash && cached.hash === hash) {
			return { output: 'usecache', headers: { 'Content-Type': 'text/plain; charset=utf8' } };
		}

		return cached;
	}

	return null;
}


function prepareFileOutput(cacheKey, output, headers, createHash) {
	// make sure we are using a Buffer object

	if (!(output instanceof Buffer)) {
		output = new Buffer(output);
	}

	// create result object

	var result = {
		output: output,
		headers: headers
	};

	// GZIP compression

	if (compressPages) {
		var gzip = require('compress-buffer');

		mithril.core.logger.debug('File ' + cacheKey + ' size before gzip compression: ' + result.output.length + ' bytes.');

		var compressed = gzip.compress(result.output);	// sometimes returns undefined

		if (compressed) {
			// compression succeeded, so replace the old string with the compressed version and provide an appropriate http header

			result.output = compressed;

			mithril.core.logger.debug('File ' + cacheKey + ' size after gzip compression: ' + result.output.length + ' bytes.');

			result.headers['Content-Encoding'] = 'gzip';
		} else {
			mithril.core.logger.error('Gzip compression failed, returning uncompressed file.');
		}
	} else {
		mithril.core.logger.debug('File ' + cacheKey + ' size: ' + result.output.length + ' bytes.');
	}

	// generate MD5 hash

	if (createHash) {
		result.hash = crypto.createHash('md5').update(output).digest('hex');

		result.headers['X-MithrilUI-Hash'] = result.hash;
	}

	// add this generated page to the page cache

	if (usePageCache) {
		mithril.core.logger.debug('Adding file to cache: ' + cacheKey);

		fileCache[cacheKey] = result;
	}

	return result;
}


function getManifestOutput(pckg, language, cb) {
	language = language || '';

	var cacheKey = 'manifest:' + pckg.name + ',' + language;

	var cached = getCachedFile(cacheKey, null);
	if (cached) {
		return cb(null, cached);
	}

	var output = pckg.manifest.get(language);
	var headers = { 'Content-Type': 'text/cache-manifest' };

	var result = prepareFileOutput(cacheKey, output, headers, false);

	// return the response information

	cb(null, result);
}


function getPageOutput(pckg, pageName, language, options, hash, cb) {
	language = language || '';

	var cacheKey = pckg.name + ',' + pageName + ',' + language + ',' + (options.incAssetMap ? '1' : '0');

	// try to use a cached version, or if the client's local cache matches ours, we tell the client to use their local cache

	if (usePageCache) {
		var cached = getCachedFile(cacheKey, hash);
		if (cached) {
			return cb(null, cached);
		}
	}

	// request not yet available in our server cache, so we generate it

	var page = pckg.getPage(pageName);
	if (!page) {
		mithril.core.logger.error('Page "' + pageName + '" not found.');
		return cb(true);
	}

	page.render(language, function (error, renderedPage) {
		if (error) {
			mithril.core.logger.error('Failed to retrieve page output for "' + pageName + '" in language "' + language + '": ' + error);
			return cb(true);
		}

		var output, headers = {};

		if (options.format && options.format === 'singleHtml') {
			renderedPage.html = renderedPage.html.replace('mui://manifest', function () {
				if (useManifest) {
					return '/mui/' + pckg.name + '/package.manifest?language=' + language;
				}

				return '';
			});

			output = new Buffer(renderedPage.html);

			headers['Content-Type'] = 'text/html; charset=utf8';
		} else {
			output = [];

			if (options.incAssetMap) {
				output.push('mui/assetmap\n' + JSON.stringify(mithril.assets.getTranslationMap(language)));
			}

			if (renderedPage.html) {
				output.push('text/html\n' + renderedPage.html);
			}

			if (renderedPage.js) {
				output.push('text/javascript\n' + renderedPage.js);
			}

			if (renderedPage.css) {
				output.push('text/css\n' + renderedPage.css);
			}

			// base output buffer and headers

			output = new Buffer(output.join(pagePartSplitString));

			headers['Content-Type'] = 'text/plain; charset=utf8';
			headers['X-MithrilUI-PartSplit'] = pagePartSplitString;
		}

		var result = prepareFileOutput(cacheKey, output, headers, true);

		// return the response information

		cb(null, result);
	});
}


function getLoaderPageOutput(pckg, language, cb) {
	language = language || '';

	var cacheKey = 'loader:' + pckg.name + ',' + language;

	var pageName = mithril.getConfig('module.mithrilui.delivery.loader.pageName');

	getPageOutput(pckg, pageName, language, { format: 'singleHtml' }, false, function (error, result) {
		if (error) {
			return cb(error);
		}

		cb(null, result);
	});
}


function setupRoutes(cb) {
	mithril.addRoute(/^\/mui\//, function (request, path, params, cb) {

		// requested path can be:
		// package
		//   eg: /mui/game
		// page in a package:
		//   eg: /mui/game/landing

		// drop /page/ and split the path into its elements

		path = path.substring(5).split('/').filter(function (elm) {
			return elm;
		});

		if (!path || path.length === 0) {
			return cb(false);
		}

		var packageName = path[0];
		var pckg = packages[packageName];

		if (!pckg) {
			mithril.core.logger.debug('Package ' + packageName + ' not found.');
			return cb(false);
		}

		switch (path.length) {
		case 1:
			// a package request, so we return the loader
			// eg: /mui/game

			getLoaderPageOutput(pckg, params.language, function (error, result) {
				if (error) {
					return cb(false);
				}

				cb(200, result.output, result.headers);
			});
			break;

		case 2:
			// a package's page or a manifest
			// eg: /mui/game/package.manifest
			// eg: /mui/game/main

			var fileName = path[1];

			if (fileName === 'package.manifest') {
				// return the manifest

				getManifestOutput(pckg, params.language, function (error, result) {
					if (error) {
						return cb(false);
					}

					cb(200, result.output, result.headers);
				});
			} else {
				// return a page

				// for caching purposes (client and server) the unique key is: pckg, fileName (page), language, assetmap included y/n
				// if params.hash matches a known hash for this combination of parameters, we return an indicator for "no changes".

				var options = {};

				if ('assetmap' in params) {
					options.incAssetMap = true;
				}

				getPageOutput(pckg, fileName, params.language, options, params.hash, function (error, result) {
					if (error) {
						return cb(false);
					}

					cb(200, result.output, result.headers);
				});
			}
			break;
		}
	});

	cb();
}


exports.setup = function (state, cb) {
	usePageCache  = !!mithril.getConfig('module.mithrilui.delivery.page.serverCache');
	compressPages = !!mithril.getConfig('module.mithrilui.delivery.page.compress');
	useManifest   = !!mithril.getConfig('module.mithrilui.delivery.package.useManifest');

	setupRoutes(cb);
};


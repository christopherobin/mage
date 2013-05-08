var fs = require('fs');
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var pathDirname = require('path').dirname;
var pathExtname = require('path').extname;
var crypto = require('crypto');
var async = require('async');
var mime = require('mime');
var mage = require('../../mage');
var logger = mage.core.logger.context('assets');

var DIGEST_MAX_PARALLEL = 10; // under benchmarks, this seems to be the sweet spot

var httpServer;

/** formats:
obj: {
  path: '/the/part/after/the/context,
  cacheability: 0,
  format: 'png',
  digest: 'aabbccdd',
  profiles: [..],     // VERY optional (leave it out, seems to be useless)
  clientMatchIf: { screen: [], density: 1 },  // optional
}

assetMap.assets: {
  contextName: {
    descriptor: {
      default: [obj, obj, obj]  // multiples if more than 1 version for a language
      en: [obj, obj]
    }
  }
}
*/

// ******************** MAIN **********************

/**
 * Local asset database.
 */
var allAssetMapsArr = [];
var allAssetMapsMap = {};



var digestCache = {};

function calcDigest(absPath, stats, cb) {
	var mtime = stats.mtime.getTime();
	var cached = digestCache[absPath];


	if (cached && cached.mtime === mtime) {
		return process.nextTick(function () {
			cb(null, cached.digest);
		});
	}

	var s = fs.createReadStream(absPath);
	var shasum = crypto.createHash('sha1');

	s.on('data', function (data) {
		shasum.update(data);
	});

	s.on('end', function () {
		var digest = shasum.digest('hex').slice(0, 8);

		digestCache[absPath] = {
			mtime: mtime,
			digest: digest
		};

		cb(null, digest);
	});

	s.on('error', function (error) {
		logger.error('Error while digesting asset', absPath);
		cb(error);
	});
}


function Asset(context, path, cacheability, format, digest, size) {
	this.context = context;
	this.path = path;
	this.cacheability = cacheability;
	this.format = format;
	this.digest = digest;
	this.size = size;
}


/**
 * An asset map.
 * @param {Object} app
 * @constructor
 */
function AssetMap(app) {
	this.app = app;

	this.src = {
		folders: [],
		pages: []
	};

	this.assets = {};
	this.routes = [];

	this.uriProtocol = null;
	this.baseUrl = null;
	this.cacheability = null;
	this.profiles = null;

	allAssetMapsArr.push(this);
	allAssetMapsMap[app.name] = this;
}


AssetMap.prototype.setup = function (options) {
	options = options || {};

	this.uriProtocol  = options.uriProtocol  || mage.core.config.get('module.assets.uriProtocol', 'mui');
	this.baseUrl      = options.baseUrl      || mage.core.config.get('module.assets.baseUrl', {});
	this.cacheability = options.cacheability || mage.core.config.get('module.assets.cacheability', {});
	this.profiles     = options.profiles     || mage.core.config.get('module.assets.profiles', {});

	// Cacheability rules from JSON are [String, Number] tuples, but we want [RegExp, Number].

	for (var context in this.cacheability) {
		var rules = this.cacheability[context];

		for (var i = 0, len = rules.length; i < len; i++) {
			var rule = rules[i];

			if (typeof rule[0] === 'string') {
				rules[i] = [new RegExp(rule[0]), rule[1]];
			}
		}
	}

	// Ensure screen is [shortEdge, longEdge] in each profile that specifies one.

	for (var profileName in this.profiles) {
		var profile = this.profiles[profileName];

		if (Array.isArray(profile.screen)) {
			profile.screen.sort();
		}
	}
};


AssetMap.prototype.getBaseUrl = function (context) {
	var baseUrl = this.baseUrl[context];

	if (baseUrl) {
		return baseUrl;
	}

	logger.warning('No baseUrl configurated for asset context:', context, '(reverting to built-in asset serving)');

	var virtualRoot = this.getVirtualRoot(context);
	if (!virtualRoot) {
		// a warning has already been logged
		return;
	}

	if (!httpServer) {
		logger.warning('Cannot create a virtual baseURL without an HTTP server');
		return;
	}

	return httpServer.getClientHostBaseUrl() + virtualRoot;
};


/**
 * Get all the assets requested by a client.
 * @param {Object} clientConfig Client's config object.
 */

AssetMap.prototype.getAssetsForConfig = function (clientConfig) {
	var myFiles = {};
	var language = clientConfig.language ? ('' + clientConfig.language).toLowerCase() : null;
	var density = clientConfig.density || 1;
	var screen = clientConfig.screen || [1, 1];

	for (var context in this.assets) {
		var baseUrl = this.getBaseUrl(context);

		myFiles[context] = {
			baseUrl: baseUrl,
			map: {}
		};

		var assets = this.assets[context];

		for (var identifier in assets) {
			// get all supported languages for this asset.

			var localizedAssets = assets[identifier];

			// if the requested language is supported, use that.
			// otherwise fall back to the default language.

			var localizedAsset = localizedAssets[language] || localizedAssets.default;

			if (!localizedAsset) {
				// The asset doesn't have a default.
				// It's most probably something that should have been translated, but wasn't.
				logger.error('Missing "' + language + '" translation for asset "' + identifier + '" in context "' + context + '". Asset not sent!');
				continue;
			}

			// Get the best profile matching the config
			var best = null;
			var bestScore = -1;

			for (var i = 0; i < localizedAsset.length; i++) {
				var variant = localizedAsset[i];
				var clientMatchIf = variant.clientMatchIf;

				// if our clientConfig is not compatible with this variant's requirements, skip this variant

				if (density < clientMatchIf.density || screen[0] < clientMatchIf.screen[0] || screen[1] < clientMatchIf.screen[1]) {
					continue;
				}

				// highest number of pixels on the screen wins

				var score = clientMatchIf.screen[0] * clientMatchIf.screen[1] * clientMatchIf.density * clientMatchIf.density;

				if (score > bestScore) {
					bestScore = score;
					best = variant;
				}
			}

			if (best === null) {
				logger.error('No suitable variant found for asset "' + identifier + '" in context "' + context + '". Asset not sent!');
				continue;
			}

			myFiles[context].map[identifier] = [best.path, best.digest, best.cacheability];
		}
	}

	return {
		clientConfig: clientConfig,
		assets: myFiles
	};
};


AssetMap.prototype.getCacheability = function (context, descriptor) {
	var cacheabilities = this.cacheability[context];
	if (cacheabilities) {
		for (var i = 0, len = cacheabilities.length; i < len; i++) {
			var tuple = cacheabilities[i];

			if (tuple[0].test(descriptor)) {
				return tuple[1];
			}
		}
	}

	// return undefined
};


function recursiveFolderIterator(absPath, relPath, fileHandler, finalCallback) {
	fs.readdir(absPath, function (error, entries) {
		if (error) {
			logger.error('Error reading directory:', absPath);
			return finalCallback(error);
		}

		async.forEachLimit(
			entries,
			DIGEST_MAX_PARALLEL,
			function (entry, callback) {
				var entryAbsPath = pathJoin(absPath, entry);
				var entryRelPath = pathJoin(relPath, entry);

				fs.stat(entryAbsPath, function (error, stats) {
					if (error) {
						logger.error('Error stat()ing file:', entryRelPath);
						return callback(error);
					}

					if (stats.isFile()) {
						fileHandler(entryAbsPath, entryRelPath, stats, callback);
					} else if (stats.isDirectory()) {
						recursiveFolderIterator(entryAbsPath, entryRelPath, fileHandler, callback);
					} else {
						callback();
					}
				});
			},
			finalCallback
		);
	});
}


AssetMap.prototype.addAsset = function (relPath, digest, size) {
	// regular expression an asset's path must match:
	// format:
	//   first:
	//       <language ID like "ja", else "default">
	//       "/"
	//       <basename, a slash-delimited path including filename up to the following "@" or ".">
	//   then optionally:
	//       "@"
	//       <comma separated profile names, eg "hires" or "hires,retina">
	//   then finally:
	//       "."
	//       <file extension>

	var ASSET_PATH_RE = /^([^\/]+)\/([^\/]+)\/(.+\/)?([^\/@]+)(?:@([^\.]+))?\.(\w+)$/;

	var m = ASSET_PATH_RE.exec(relPath);
	if (!m) {
		logger.warning('Not identified as an asset:', relPath);
		return;
	}

	var contextName = m[1];              // img, font, bgm, ...
	var languageId = m[2].toLowerCase(); // en, fr, nl, default
	var subFolders = m[3];               // directory in which basename sits (will contain a trailing slash)
	var basename = m[4];                 // filename without file extension or profiles
	var profileNames = m[5] ? m[5].split(',') : [];  // all profiles this asset can be used for (defaults to all profiles)
	var format = m[6].toLowerCase();     // file extension
	var descriptor = pathJoin(subFolders, basename);
	var path = relPath.substring(contextName.length);
	var cacheability = this.getCacheability(contextName, descriptor);

	var obj = new Asset(contextName, path, cacheability, format, digest, size);

	var context = this.assets[contextName];
	if (!context) {
		context = this.assets[contextName] = {};
	}

	var asset = context[descriptor];
	if (!asset) {
		asset = context[descriptor] = {};
	}

	var localizedAsset = asset[languageId];
	if (!localizedAsset) {
		localizedAsset = asset[languageId] = [];
	}

	var clientMatchIf = { density: 1, screen: [1, 1] };

	for (var i = 0; i < profileNames.length; i++) {
		var profileName = profileNames[i];
		var profile = this.profiles[profileName];

		if (!profile) {
			logger.error('Unknown profile "' + profileName + '" found (path: "' + relPath + '").');
			continue;
		}

		if (profile.density && clientMatchIf.density < profile.density) {
			clientMatchIf.density = profile.density;
		}

		if (profile.screen) {
			if (clientMatchIf.screen[0] < profile.screen[0]) {
				clientMatchIf.screen[0] = profile.screen[0];
			}

			if (clientMatchIf.screen[1] < profile.screen[1]) {
				clientMatchIf.screen[1] = profile.screen[1];
			}
		}
	}

	obj.clientMatchIf = clientMatchIf;
	obj.profiles = profileNames;

	localizedAsset.push(obj);

	return obj;
};


AssetMap.prototype.getVirtualRoot = function (context) {
	var appName = this.app ? this.app.name : null;

	if (!appName) {
		logger.warning('Cannot generate a virtual root path for assets on a nameless app');
		return;
	}

	return '/app/' + appName + '-assets/' + context;
};


AssetMap.prototype.exposeAsset = function (asset, absPath) {
	if (!httpServer) {
		logger.warning('Cannot expose assets without an HTTP server');
		return;
	}

	var virtualRoot = this.getVirtualRoot(asset.context);
	if (!virtualRoot) {
		// a warning has already been logged
		return;
	}

	var route = virtualRoot + asset.path;
	var mimetype = mime.lookup(asset.format);

	function serveFile(req, res) {
		// see if the client still has an uptodate version

		if (req.headers['if-none-match'] === asset.digest) {
			res.writeHead(304); // not modified
			res.end();
			return;
		}

		var s = fs.createReadStream(absPath);

		s.on('error', function (error) {
			logger.error('Error while loading asset:', error);

			if (error.code === 'ENOENT') {
				res.writeHead(404); // resource not found
			} else {
				res.writeHead(500); // internal server error
			}

			res.end();
		});

		res.writeHead(200, {
			'Content-Type': mimetype,
			ETag: asset.digest
		});

		s.pipe(res);
	}

	httpServer.addRoute(route, function (req, res) {
		if (req.method === 'GET') {
			serveFile(req, res);
		} else {
			res.writeHead(400); // bad request
			res.end();
		}
	}, true);

	this.routes.push(route);

	return route;
};


AssetMap.prototype.indexFolder = function (folder, cb) {
	var that = this;
	var startTime = Date.now();
	var count = 0;

	folder = pathResolve(pathDirname(process.mainModule.filename), folder);


	function fileHandler(absPath, relPath, stats, callback) {
		calcDigest(absPath, stats, function (error, digest) {
			if (error) {
				return callback(error);
			}

			var asset = that.addAsset(relPath, digest, stats.size);

			if (!asset) {
				return callback();
			}

			var route = that.exposeAsset(asset, absPath);

			// if there is a route, its registration will have logged it
			// if there was none, we'll log the addition of the asset into the asset map

			if (!route) {
				logger.verbose('Added asset:', asset, '(not exposed)');
			}

			count += 1;

			callback();
		});
	}

	recursiveFolderIterator(folder, '', fileHandler, function (error) {
		logger.time('Asset map indexing took', Date.now() - startTime, 'msec for', count, 'assets');

		cb(error);
	});
};


AssetMap.prototype.indexPage = function (pageInfo) {
	var name = pageInfo.name;
	var context = pageInfo.context;
	var descriptor = pageInfo.descriptor;
	var path = pageInfo.path;
	var format = pathExtname(path);

	if (format[0] === '.') {
		format = format.substr(1);
	}

	var ctx = this.assets[context];
	if (!ctx) {
		ctx = this.assets[context] = {};
	}

	var dsc = ctx[descriptor];
	if (!dsc) {
		dsc = ctx[descriptor] = {};
	}

	// for each language, get the build

	var variants = this.app.getPageVariants(name);

	for (var i = 0, len = variants.length; i < len; i++) {
		var variant = variants[i];

		var localized = dsc[variant.language];
		if (!localized) {
			localized = dsc[variant.language] = [];
		}

		var obj = {
			path: path,
			format: format,
			digest: variant.digest,
			cacheability: this.getCacheability(context, descriptor),
			clientMatchIf: { density: 1, screen: [1, 1] },
			profiles: [],
			size: 0
		};

		localized.push(obj);
	}
};


AssetMap.prototype.reset = function () {
	this.assets = {};

	if (httpServer) {
		for (var i = 0; i < this.routes.length; i++) {
			httpServer.delRoute(this.routes[i]);
		}
	}

	this.routes = [];
};


AssetMap.prototype.reindex = function (cb) {
	var that = this;

	this.reset();

	async.series([
		function folderIndexing(callback) {
			async.forEachSeries(
				that.src.folders,
				function (folder, callback) {
					that.indexFolder(folder, callback);
				},
				callback
			);
		},
		function pageIndexing(callback) {
			that.src.pages.forEach(function (pageInfo) {
				that.indexPage(pageInfo);
			});

			callback();
		}
	], cb);
};


/**
 * Scan the content of a folder, adding any encountered asset to the asset map.
 * @param {string} folder Folder path, relative to the app's folder.
 */
AssetMap.prototype.addFolder = function (folder) {
	this.src.folders.push(folder);
};


/**
 */

AssetMap.prototype.addPage = function (context, descriptor, pageName, path) {
	path = path.substring(context.length);

	this.src.pages.push({
		context: context,
		descriptor: descriptor,
		name: pageName,
		path: path
	});
};


// Asset map builder
function buildAssetMap(buildTarget, clientConfig, contextName, assetMap, cb) {
	logger.verbose('Building asset map');

	if (assetMap) {
		assetMap.reindex(function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, JSON.stringify(assetMap.getAssetsForConfig(clientConfig)));
		});
	} else {
		logger.error('No asset map registered on app', buildTarget.describe());
		cb('noAssetMap');
	}
}


exports.listAssetMaps = function () {
	return Object.keys(allAssetMapsMap);
};


exports.getAssetMap = function (appName, cb) {
	var map = allAssetMapsMap[appName];
	if (!map) {
		return cb(new Error('Asset map not found'));
	}

	map.reindex(function (error) {
		if (error) {
			return cb(error);
		}

		var result = {
			assets: map.assets,
			contexts: {},
			clientConfigs: map.app.clientConfigs
		};

		for (var context in map.assets) {
			result.contexts[context] = {
				baseUrl: map.getBaseUrl(context)
			};
		}

		return cb(null, result);
	});
};


// ******************* EXPORTS *********************

exports.setup = function (state, cb) {
	httpServer = mage.core.msgServer.getHttpServer();

	mage.core.app.builders.add('assets', buildAssetMap);
	mage.core.app.contexts.add('assetmap', 'text/assetmap; charset=utf8', '\n');
	cb();
};

exports.AssetMap = AssetMap;

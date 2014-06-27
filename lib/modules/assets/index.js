var fs = require('fs');
var mkdirp = require('mkdirp');
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var pathDirname = require('path').dirname;
var pathExtname = require('path').extname;
var crypto = require('crypto');
var async = require('async');
var mime = require('mime');
var mage = require('../../mage');
var logger = mage.core.logger.context('assets');

var DIGEST_MAX_PARALLEL = 5;

var httpServer = mage.core.msgServer.getHttpServer();

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

function Digest(path, digest, mtime) {
	this.path = path;
	this.digest = digest;
	this.mtime = mtime;
	this.exists = false;
}


Digest.prototype.toJSON = function () {
	if (!this.exists) {
		return undefined;
	}

	return {
		digest: this.digest,
		mtime: this.mtime
	};
};


Digest.fromJSON = function (path, info) {
	return new Digest(path, info.digest, info.mtime);
};


Digest.prototype.calc = function (stats, cb) {
	var mtime = stats.mtime.getTime();
	this.exists = true;

	if (mtime === this.mtime) {
		return setImmediate(cb);
	}

	var path = this.path;

	var s = fs.createReadStream(path);
	var shasum = crypto.createHash('sha1');
	var that = this;

	this.mtime = mtime;
	this.digest = null;

	s.on('data', function (data) {
		shasum.update(data);
	});

	s.on('end', function () {
		that.digest = shasum.digest('hex').slice(0, 8);
		cb();
	});

	s.on('error', function (error) {
		logger.error('Error while digesting asset', path, error);
		cb(error);
	});
};


/**
 * Local asset database.
 */
var allAssetMapsArr = [];
var allAssetMapsMap = {};


function writeBufferList(buffers, flags, path, cb) {
	var folder = pathDirname(path);

	mkdirp(folder, function (error) {
		if (error) {
			return cb(error);
		}

		var stream;

		try {
			stream = fs.createWriteStream(path, { flags: flags });
		} catch (createError) {
			return cb(createError);
		}

		stream.once('error', cb);
		stream.once('close', cb);

		stream.once('open', function () {
			for (var i = 0; i < buffers.length; i++) {
				stream.write(buffers[i]);
			}

			stream.end();
		});
	});
}


function Asset(absPath, relPath, context, ident, language, path, cacheability,
               format, digest, size, clientMatchIf, profiles) {
	this.absPath = absPath;
	this.relPath = relPath;
	this.context = context;
	this.ident = ident;
	this.language = language;
	this.path = path;     // path without context
	this.cacheability = cacheability;
	this.format = format;
	this.digest = digest;
	this.size = size;
	this.clientMatchIf = clientMatchIf;
	this.profiles = profiles;
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

	// data, populated on setup

	this.uriProtocol = null;
	this.baseUrl = null;
	this.cacheability = null;
	this.profiles = null;

	// data, populated after indexing

	this.indexStatus = 'unindexed';  // "unindexed", "indexed", "indexing"
	this.indexCallbacks = [];
	this.assets = {};
	this.assetList = [];
	this.languages = [];

	allAssetMapsArr.push(this);
	allAssetMapsMap[app.name] = this;

	var that = this;

	httpServer.addRoute(new RegExp('^/app/' + app.name + '-assets/'), function () {
		that.serveAsset.apply(that, arguments);
	}, true);
}


AssetMap.prototype.setup = function (options) {
	options = options || {};

	this.uriProtocol  = options.uriProtocol  || mage.core.config.get(['module', 'assets', 'uriProtocol'], 'mui');
	this.baseUrl      = options.baseUrl      || mage.core.config.get(['module', 'assets', 'baseUrl'], {});
	this.cacheability = options.cacheability || mage.core.config.get(['module', 'assets', 'cacheability'], {});
	this.profiles     = options.profiles     || mage.core.config.get(['module', 'assets', 'profiles'], {});

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


/**
 * Add the folder to the list of folders to index
 *
 * @param {string} folder Folder path, relative to the app's folder.
 */

AssetMap.prototype.addFolder = function (folder) {
	this.src.folders.push(folder);
};


/**
 * Add the (index) page to the list of pages to refer to in the asset map
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


AssetMap.prototype.getBaseUrl = function (context, headers) {
	var baseUrl = this.baseUrl[context];

	if (baseUrl) {
		return baseUrl;
	}

	logger.warning(
		'No baseUrl configured for asset context:', context,
		'(reverting to built-in asset serving)'
	);

	var virtualRoot = this.getVirtualRoot(context);
	if (!virtualRoot) {
		// a warning has already been logged
		return;
	}

	if (!httpServer) {
		logger.warning('Cannot create a virtual baseURL without an HTTP server');
		return;
	}

	return httpServer.getClientHostBaseUrl(headers) + virtualRoot;
};


/**
 * Get all the assets requested by a client.
 *
 * @param {Object} clientConfig Client's config object.
 * @param {Object} [req]        HTTP Request object.
 */

AssetMap.prototype.getAssetsForConfig = function (clientConfig, req) {
	var myFiles = {};
	var language = clientConfig.language ? ('' + clientConfig.language).toLowerCase() : null;
	var density = clientConfig.density || 1;
	var screen = clientConfig.screen || [0, 0];

	for (var context in this.assets) {
		var baseUrl = this.getBaseUrl(context, req && req.headers);

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

				logger.error(
					'Missing "' + language + '" translation for asset "' + identifier + '" ' +
					'in context "' + context + '". Asset not sent!'
				);
				continue;
			}

			// Get the best profile matching the config
			var best;
			var bestScore = -1;

			for (var i = 0; i < localizedAsset.length; i++) {
				var variant = localizedAsset[i];
				var clientMatchIf = variant.clientMatchIf;

				// if our clientConfig is not compatible with this variant's requirements, skip this variant

				if (density < clientMatchIf.density) {
					continue;
				}

				if (screen[0] < clientMatchIf.screen[0] || screen[1] < clientMatchIf.screen[1]) {
					continue;
				}

				// highest number of pixels on the screen wins

				var score = clientMatchIf.screen[0] * clientMatchIf.screen[1] *
					clientMatchIf.density * clientMatchIf.density;

				if (score > bestScore) {
					bestScore = score;
					best = variant;
				}
			}

			if (!best) {
				logger.error(
					'No suitable variant found for asset "' + identifier + '" in context ' +
					'"' + context + '". Asset not sent!'
				);
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


function recursiveFolderIterator(absRoot, relRoot, parallelLimit, fileHandler, cb) {
	var queue;

	function worker(path, callback) {
		fs.stat(path.abs, function (error, stats) {
			if (error) {
				logger.error('Error stat()ing file:', path.abs);
				return callback(error);
			}

			if (stats.isFile()) {
				return fileHandler(path.abs, path.rel, stats, callback);
			}

			if (stats.isDirectory()) {
				return fs.readdir(path.abs, function (error, files) {
					if (error) {
						logger.error('Error reading directory:', path.abs);
						return callback(error);
					}

					for (var i = 0; i < files.length; i++) {
						var fileName = files[i];

						if (fileName[0] === '.') {
							// skip hidden files
							continue;
						}

						queue.push({
							abs: pathJoin(path.abs, fileName),
							rel: pathJoin(path.rel, fileName)
						});
					}

					return callback();
				});
			}

			return callback();
		});
	}


	if (parallelLimit < 1) {
		parallelLimit = 1;
	}

	queue = async.queue(worker, parallelLimit);
	queue.drain = cb;
	queue.push({ abs: absRoot, rel: relRoot });
}


function parsePath(relPath) {
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

	var ASSET_PATH_RE = /^([^\/]+)\/([^\/]+)\/(.+\/)?([^\/@]+)(?:@([^\.]+))?\.(.+)$/;

	var m = ASSET_PATH_RE.exec(relPath);
	if (!m) {
		logger.warning('Not identified as an asset:', relPath);
		return;
	}

	return {
		context: m[1],                  // img, font, bgm, ...
		language: m[2].toLowerCase(),   // default, ja, en, nl
		subFolders: m[3],               // directory containing basename (contains a trailing slash)
		basename: m[4],                 // filename without file extension or profiles
		profileNames: m[5] ? m[5].split(',').sort() : [],  // all compatible profiles (default: all)
		format: m[6].toLowerCase()      // file extension
	};
}


function createRelPath(context, ident, language, profiles, format) {
	var path = context + '/' + (language ? language.toLowerCase() : 'default') + '/' + ident;

	if (Array.isArray(profiles) && profiles.length > 0) {
		profiles.sort();

		path += '@' + profiles.join(',');
	}

	path += '.' + format;
	return path;
}


AssetMap.prototype.getAssetByRelPath = function (relPath) {
	for (var i = 0, len = this.assetList.length; i < len; i++) {
		if (this.assetList[i].relPath === relPath) {
			return this.assetList[i];
		}
	}
};


AssetMap.prototype.addAsset = function (absPath, relPath, digest, size) {
	var parsed = parsePath(relPath);
	if (!parsed) {
		return;
	}

	var ident = parsed.subFolders ? pathJoin(parsed.subFolders, parsed.basename) : parsed.basename;
	var path = relPath.substring(parsed.context.length);
	var cacheability = this.getCacheability(parsed.context, ident);

	if (!this.assets[parsed.context]) {
		this.assets[parsed.context] = {};
	}

	if (!this.assets[parsed.context][ident]) {
		this.assets[parsed.context][ident] = {};
	}

	var localizedAsset = this.assets[parsed.context][ident][parsed.language];
	if (!localizedAsset) {
		localizedAsset = this.assets[parsed.context][ident][parsed.language] = [];
	}

	if (this.languages.indexOf(parsed.language) === -1) {
		this.languages.push(parsed.language);
	}

	var clientMatchIf = { density: 1, screen: [0, 0] };

	for (var i = 0; i < parsed.profileNames.length; i++) {
		var profileName = parsed.profileNames[i];
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

	var obj = new Asset(absPath, relPath, parsed.context, ident, parsed.language, path,
		cacheability, parsed.format, digest, size, clientMatchIf, parsed.profileNames);

	localizedAsset.push(obj);
	this.assetList.push(obj);

	return obj;
};


AssetMap.prototype.removeAsset = function (asset) {
	// remove from asset lookup map

	var localizedAsset = this.assets[asset.context][asset.ident][asset.language];

	for (var i = 0; i < localizedAsset.length; i++) {
		if (localizedAsset[i] === asset) {
			localizedAsset.splice(i, 1);
			break;
		}
	}

	// remove from asset lookup list

	var index = this.assetList.indexOf(asset);
	if (index !== -1) {
		this.assetList.splice(index, 1);
	}
};


AssetMap.prototype.getVirtualRoot = function (context) {
	var appName = this.app ? this.app.name : null;

	if (!appName) {
		logger.warning('Cannot generate a virtual root path for assets on a nameless app');
		return;
	}

	return '/app/' + appName + '-assets/' + context;
};


AssetMap.prototype.serveAsset = function (req, res, path) {
	var str = '/app/' + this.app.name + '-assets/';

	if (path.substr(0, str.length) === str) {
		path = path.slice(str.length);
	}

	var that = this;

	this.reindex(false, function () {
		var asset = that.getAssetByRelPath(path);
		if (!asset) {
			logger.warning('Could not find asset by path:', path);

			res.writeHead(404);
			res.end();
			return;
		}

		// check if the client still has an uptodate version

		if (req.headers['if-none-match'] === asset.digest) {
			logger.verbose('Asset', path, 'has not changed');

			res.writeHead(304); // not modified
			res.end();
			return;
		}

		// serve the file

		logger.verbose('Serving asset at path:', path);

		var s = fs.createReadStream(asset.absPath);

		s.on('error', function (error) {
			if (error.code === 'ENOENT') {
				logger.warning('Asset not found on disk:', asset.absPath, '(404)');

				res.writeHead(404); // resource not found
			} else {
				logger.error('Error while loading asset:', error);

				res.writeHead(500); // internal server error
			}

			res.end();
		});

		res.writeHead(200, {
			'content-type': mime.lookup(asset.format),
			ETag: asset.digest
		});

		s.pipe(res);
	});
};


AssetMap.prototype.indexAsset = function (absPath, relPath, stats, digestCache, cb) {
	var digest = digestCache && digestCache[absPath];

	if (!digest) {
		digest = new Digest(absPath);
	}

	var that = this;

	digest.calc(stats, function (error) {
		if (error) {
			return cb(error);
		}

		if (digestCache) {
			digestCache[absPath] = digest;
		}

		that.addAsset(absPath, relPath, digest.digest, stats.size);

		cb();
	});
};


AssetMap.prototype.loadDigestCache = function (folder, cb) {
	var digestCachePath = pathJoin(folder, '.digest-cache.json');

	fs.readFile(digestCachePath, 'utf8', function (error, cache) {
		if (error) {
			if (error.code !== 'ENOENT') {
				logger.warning('Error while trying to read', digestCachePath);
			}
		}

		try {
			cache = cache && JSON.parse(cache) || {};
		} catch (parseError) {
			logger.error('Error while parsing digest cache', parseError);
			cache = {};
		}

		// replace cache entries with Digest instances (for smart toJSON serialization)

		var paths = Object.keys(cache);
		for (var i = 0, len = paths.length; i < len; i++) {
			var path = paths[i];

			cache[path] = Digest.fromJSON(path, cache[path]);
		}

		cb(error, cache);
	});
};


AssetMap.prototype.saveDigestCache = function (folder, cache, cb) {
	var digestCachePath = pathJoin(folder, '.digest-cache.json');

	fs.writeFile(digestCachePath, JSON.stringify(cache, null, '\t'), cb);
};


AssetMap.prototype.indexFolder = function (folder, cb) {
	var that = this;
	var startTime = process.hrtime();

	folder = pathResolve(process.cwd(), folder);

	logger.debug('Indexing folder', folder);

	this.loadDigestCache(folder, function (error, digestCache) {
		// ignore load errors

		function fileHandler(absPath, relPath, stats, callback) {
			that.indexAsset(absPath, relPath, stats, digestCache, callback);
		}

		recursiveFolderIterator(folder, '', DIGEST_MAX_PARALLEL, fileHandler, function (error) {
			if (error) {
				logger.emergency('Asset indexing failed:', error);
				return cb(error);
			}

			var durationRaw = process.hrtime(startTime);
			var duration = durationRaw[0] + durationRaw[1] / 1e9;

			logger.info
				.data({ durationMsec: 1000 * duration })
				.log('Completed asset indexing.');

			that.saveDigestCache(folder, digestCache, cb);
		});
	});
};


AssetMap.prototype.indexPage = function (pageInfo) {
	logger.verbose('Indexing page', pageInfo);

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

	// for each clientconfig, get the build

	var variants = this.app.getIndexPageVariants(name);

	if (variants.length === 0) {
		logger.warning('No variants were reported for page', pageInfo.name);
		return;
	}

	for (var i = 0; i < variants.length; i++) {
		var variant = variants[i];

		var localized = dsc[variant.clientConfig.language];
		if (!localized) {
			localized = dsc[variant.clientConfig.language] = [];
		}

		var obj = {
			path: path,
			format: format,
			digest: variant.digest,
			cacheability: this.getCacheability(context, descriptor),
			clientMatchIf: {
				density: variant.clientConfig.density,
				screen: variant.clientConfig.screen
			},
			size: 0
		};

		logger.verbose('Registered a variant for page', pageInfo.name, variant);

		localized.push(obj);
	}
};


AssetMap.prototype.reset = function () {
	this.assets = {};
	this.assetList = [];
};


AssetMap.prototype.reindex = function (force, cb) {
	// if already indexed and not forced to redo it, return immediately

	if (!force && this.indexStatus === 'indexed') {
		return cb();
	}

	var indexCallbacks = this.indexCallbacks;

	indexCallbacks.push(cb);

	if (this.indexStatus === 'indexing') {
		return;
	}

	this.indexStatus = 'indexing';

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
	], function () {
		that.indexStatus = 'indexed';

		while (indexCallbacks.length > 0) {
			var callback = indexCallbacks.shift();
			callback();
		}
	});
};


/**
 * Returns an array of context names, as indicated by the folders on disk.
 * Even empty ones are returned.
 *
 * @param cb
 */

AssetMap.prototype.indexContextNames = function (cb) {
	var contextNames = [];

	function index(folder, callback) {
		fs.readdir(folder, function (error, files) {
			if (error) {
				return callback(error);
			}

			async.forEachSeries(
				files,
				function (file, callback) {
					if (contextNames.indexOf(file) !== -1) {
						// context already found
						return callback();
					}

					fs.stat(pathJoin(folder, file), function (error, stats) {
						if (error) {
							return callback(error);
						}

						if (stats.isDirectory()) {
							contextNames.push(file);
						}

						callback();
					});
				},
				callback
			);
		});
	}

	async.forEachSeries(
		this.src.folders,
		index,
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, contextNames);
		}
	);
};


// mutations

AssetMap.prototype.updateVariants = function (context, ident, changes, cb) {
	var that = this;

	// flatten all languages down into a single array

	var assetsByLanguage = this.assets[context] ? this.assets[context][ident] : [];
	var assets = [];

	for (var languageId in assetsByLanguage) {
		assets = assets.concat(assetsByLanguage[languageId]);
	}

	var i, change, sourceRelPath, sourceAbsPath, targetRelPath, targetAbsPath;

	var deletes = [];
	var renames = [];
	var writes = [];

	// step 1: assign an asset object to every change that points to an existing asset

	for (i = 0; i < changes.length; i++) {
		change = changes[i];

		if (change.relPath) {
			var asset = this.getAssetByRelPath(change.relPath);
			if (asset) {
				change.originalAsset = asset;
			}
		}
	}

	// step 2: queue delete operations

	for (i = 0; i < changes.length; i++) {
		change = changes[i];

		// delete "delete" operations and old versions of "change" operations that carry a new file

		if (change.originalAsset && (change.operation === 'delete' || change.file)) {
			deletes.push(change.originalAsset.absPath);

			// update the asset map

			this.removeAsset(change.originalAsset);
			change.originalAsset = null;
		}
	}

	// step 3: queue rename operations

	var virtualPaths = {};

	for (i = 0; i < assets.length; i++) {
        virtualPaths[assets[i].absPath] = true;
	}

	var lastTempId = 0;

	function createTempRelPath(change) {
		lastTempId += 1;

		return createRelPath(
			context, ident, change.language, change.profiles, change.format + '-tmp' + lastTempId
		);
	}

	function makeAbs(relPath) {
		var folder = that.src.folders[0];
		if (folder) {
			return pathResolve(process.cwd(), folder, relPath);
		}
	}

	// make a copy of the changes array, so we can grow it only for this loop

	var changesCopy = changes.slice();

	for (i = 0; i < changesCopy.length; i++) {
		change = changesCopy[i];

		if (change.operation === 'delete' || !change.relPath) {
			continue;
		}

		sourceRelPath = change.relPath;
		targetRelPath = createRelPath(
			context, ident, change.language, change.profiles, change.format
		);

		if (sourceRelPath === targetRelPath) {
			// no rename
			continue;
		}

		sourceAbsPath = change.originalAsset ?
			change.originalAsset.absPath :
			makeAbs(sourceRelPath);
		targetAbsPath = makeAbs(targetRelPath);

		if (virtualPaths[targetAbsPath]) {
			// file already exists at that path: collision!
			// schedule a rename to a temp file

			targetRelPath = createTempRelPath(change);
			targetAbsPath = makeAbs(targetRelPath);

			// queue the real rename to happen at the end

			change.relPath = targetRelPath;
			changesCopy.push(change);
		}

		// queue the rename operation

		renames.push({ from: sourceAbsPath, to: targetAbsPath });

		// update the asset map

		if (change.originalAsset) {
			this.removeAsset(change.originalAsset);

			change.originalAsset = this.addAsset(
				targetAbsPath, targetRelPath, change.originalAsset.digest, change.originalAsset.size
			);
		}

		// update the virtual paths map to reflect which filenames now exist and which don't

		virtualPaths[sourceAbsPath] = false;
		virtualPaths[targetAbsPath] = true;
	}

	// step 4: queue file write operations

	for (i = 0; i < changes.length; i++) {
		change = changes[i];

		if (change.operation === 'delete' || !change.file) {
			continue;
		}

		// all writes are essentially new files now, since the delete queue gets rid of old versions

		targetRelPath = createRelPath(
			context, ident, change.language, change.profiles, change.format
		);
		targetAbsPath = makeAbs(targetRelPath);

		writes.push({
			absPath: targetAbsPath,
			relPath: targetRelPath,
			buffers: change.file.data
		});

		// updating the asset map happens once writes are done, so digests are calculated and cached
	}

	// step 5: execution logic

	function runDeletes(callback) {
		async.forEachSeries(
			deletes,
			function (path, callback) {
				fs.unlink(path, function (error) {
					if (error) {
						logger.error(error);
					}
					callback();
				});
			},
			callback
		);
	}

	function runRenames(callback) {
		async.forEachSeries(
			renames,
			function (rename, callback) {
				fs.rename(rename.from, rename.to, function (error) {
					if (error) {
						logger.error(error);
					}
					callback();
				});
			},
			callback
		);
	}

	function runWrites(callback) {
		async.forEachSeries(
			writes,
			function (write, callback) {
				logger.verbose.data(write).log('Writing asset:', write.absPath);

				writeBufferList(write.buffers, 'w', write.absPath, function (error) {
					if (error) {
						logger.error('Error writing buffer list:', error);
						return callback();
					}

					// update the asset map

					fs.stat(write.absPath, function (error, stats) {
						if (error) {
							logger.error('Error statting new file:', write.absPath, error);
							return callback();
						}

						that.indexAsset(write.absPath, write.relPath, stats, null, function () {
							// errors are already logged
							callback();
						});
					});
				});
			},
			callback
		);
	}

	// step 6: now really execute

	async.series([
		runDeletes,
		runRenames,
		runWrites
	], cb);
};


function moveFile(from, to, cb) {
	// creates missing folders in the process

	fs.exists(to, function (exists) {
		if (exists) {
			return cb(new Error('File already exists: ' + to));
		}

		mkdirp(pathDirname(to), function (error) {
			if (error) {
				return cb(error);
			}

			fs.rename(from, to, cb);
		});
	});
}

AssetMap.prototype.renameAsset = function (state, contextName, oldIdent, newIdent, cb) {
	if (!this.assets[contextName]) {
		return state.error(null, 'Unknown context: ' + contextName, cb);
	}

	if (this.assets[contextName][newIdent]) {
		return state.error(null, 'An asset with identifier "' + newIdent + '" already exists.', cb);
	}

	var assetsByLanguage = this.assets[contextName][oldIdent];
	if (!assetsByLanguage) {
		return state.error(null, 'Asset "' + oldIdent + '" not found.', cb);
	}

	var assets = [];

	for (var languageId in assetsByLanguage) {
		assets = assets.concat(assetsByLanguage[languageId]);
	}

	var that = this;

	async.forEachSeries(
		assets,
		function (asset, callback) {
			var newAbsPath = asset.absPath.replace(oldIdent, newIdent);
			var newRelPath = asset.relPath.replace(oldIdent, newIdent);

			moveFile(asset.absPath, newAbsPath, function (error) {
				if (error) {
					return callback(error);
				}

				that.removeAsset(asset);

				that.addAsset(newAbsPath, newRelPath, asset.digest, asset.size);

				callback();
			});
		},
		cb
	);
};


AssetMap.prototype.deleteAsset = function (state, contextName, ident, cb) {
	if (!this.assets[contextName]) {
		return state.error(null, 'Unknown context: ' + contextName, cb);
	}

	var assetsByLanguage = this.assets[contextName][ident];
	if (!assetsByLanguage) {
		return state.error(null, 'Asset "' + ident + '" not found.', cb);
	}

	var assets = [];

	for (var languageId in assetsByLanguage) {
		assets = assets.concat(assetsByLanguage[languageId]);
	}

	var that = this;

	async.forEachSeries(
		assets,
		function (asset, callback) {
			fs.unlink(asset.absPath, function (error) {
				if (error) {
					return state.error(null, error, callback);
				}

				that.removeAsset(asset);

				callback();
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			delete that.assets[contextName][ident];

			cb();
		}
	);
};


exports.listAssetMaps = function () {
	return Object.keys(allAssetMapsMap);
};


exports.renameAsset = function (state, appName, context, oldIdent, newIdent, cb) {
	var assetMap = allAssetMapsMap[appName];
	if (!assetMap) {
		return state.error(null, 'Asset map not found', cb);
	}

	assetMap.reindex(false, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		assetMap.renameAsset(state, context, oldIdent, newIdent, function (error) {
			if (error) {
				return state.error(null, error, cb);
			}

			var assetsByLanguage = assetMap.assets[context] ?
				assetMap.assets[context][newIdent] :
				null;

			cb(null, assetsByLanguage || {});
		});
	});
};


exports.deleteAsset = function (state, appName, context, ident, cb) {
	var assetMap = allAssetMapsMap[appName];
	if (!assetMap) {
		return state.error(null, 'Asset map not found', cb);
	}

	assetMap.reindex(false, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		assetMap.deleteAsset(state, context, ident, cb);
	});
};


exports.updateVariants = function (state, appName, context, ident, changes, cb) {
	var assetMap = allAssetMapsMap[appName];
	if (!assetMap) {
		return state.error(null, 'Asset map not found', cb);
	}

	assetMap.reindex(false, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		assetMap.updateVariants(context, ident, changes, function (error) {
			if (error) {
				return state.error(null, error, cb);
			}

			var assetsByLanguage = assetMap.assets[context] ?
				assetMap.assets[context][ident] :
				null;

			cb(null, assetsByLanguage || {});
		});
	});
};


exports.getAssetMap = function (appName, forceReindex, cb) {
	var map = allAssetMapsMap[appName];
	if (!map) {
		return cb(new Error('Asset map not found: ' + appName));
	}

	map.reindex(forceReindex || false, function (error) {
		if (error) {
			return cb(error);
		}

		var result = {
			appName: map.app.name,
			contexts: {},
			clientConfigs: map.app.clientConfigs,
			languages: map.languages,
			profiles: map.profiles,
			assets: map.assets
		};

		map.indexContextNames(function (error, contextNames) {
			if (error) {
				return cb(error);
			}

			for (var i = 0; i < contextNames.length; i++) {
				var contextName = contextNames[i];

				result.contexts[contextName] = {
					name: contextName,
					baseUrl: map.getBaseUrl(contextName)
				};
			}

			return cb(null, result);

		});
	});
};


// ******************* EXPORTS *********************

var builder = {
	build: function (buildTarget, clientConfig, req, contextName, assetMap, cb) {
		logger.verbose('Building asset map');

		if (!assetMap) {
			logger.error('No asset map registered on app', buildTarget.describe());
			return cb('noAssetMap');
		}

		assetMap.reindex(true, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, JSON.stringify(assetMap.getAssetsForConfig(clientConfig, req)));
		});
	}
};


mage.core.app.builders.add('assets', builder);
mage.core.app.contexts.add('assetmap', 'text/assetmap; charset=UTF-8', '\n');

exports.AssetMap = AssetMap;

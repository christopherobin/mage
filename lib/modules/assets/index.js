"use strict";

var fs = require('fs'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter,
    crypto = require('crypto'),
    async = require('async'),
    mithril = require('../../mithril'),
    logger = mithril.core.logger;

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

// ****************** UTILITIES ********************

/**
 * A folder traversal object.
 * @param {String} dir Path to the directory to traverse.
 * @constructor
 * @private
 */
function FolderTraversal(dir) {
	EventEmitter.prototype.constructor.call(this);

	var queue = [], busy = false, remaining = 0, errors = [], self = this;

	self.on('dir', function (folder, entries) {
		remaining += entries.length;

		entries.forEach(function (entry) {
			var fullEntry = path.join(folder, entry);

			fs.stat(path.join(dir, fullEntry), function (err, stat) {
				if (err) {
					errors.push(err);
				} else {
					self.emit(stat && stat.isDirectory() ? 'run' : 'file', fullEntry);
				}

				if (--remaining === 0) {
					self.emit('end', errors.length ? errors : null);
				}
			});
		});
	});

	self.on('processQueue', function () {
		queue.forEach(function (folder) {
			fs.readdir(path.join(dir, folder), function (err, entries) {
				if (err) {
					errors.push(err);
				} else {
					self.emit('dir', folder, entries);
				}
				if (--remaining === 0) {
					self.emit('end', errors.length ? errors : null);
				}
			});
		});
		queue = [];
		busy = false;
	});

	self.on('run', function (folder) {
		++remaining;
		queue.push(folder || null);

		if (!busy) {
			process.nextTick(function () {
				self.emit('processQueue');
			});

			busy = true;
		}
	});
}

FolderTraversal.prototype = Object.create(EventEmitter.prototype);
FolderTraversal.prototype.constructor = FolderTraversal;

/**
 * Traverse a folder.
 * @param {String}                    dir      Path to the directory to traverse. Use null for the current directory.
 * @param {function(String, ?Object)} iterator Function that receives file paths relative to the folder.
 * @param {function(?Array)}          callback Callback with array of errors encountered while traversing.
 *
 * Example:
 *
 *   FolderTraversal.traverse(
 *     '/var/log',
 *     function(fn) {
 *       console.log('/var/log/' + fn);
 *     },
 *     function(errors) {
 *       if (errors) console.log('Errors: ' + errors);
 *     }
 *   );
 */
FolderTraversal.traverse = function (dir, iterator, callback) {
	var traverse = new FolderTraversal(dir);

	traverse.on('file', iterator);

	traverse.on('end', function (err) {
		callback(err);
	});

	traverse.emit('run');
};

// ******************** MAIN **********************

/**
 * Regular expression an asset's path must match.
 * @const
 * @type {RegExp}
 * @private
 */
var ASSET_PATH_RE = /^([^\/]+)\/([^\/]+)\/(.+\/)?([^\/@]+)(?:@([^\.]+))?\.(\w+)$/;

/**
 * Local asset database.
 * @type {Array}
 * @private
 */
var allAssetMapsArr = [];

/**
 * An asset map.
 * @param {?Object=} options
 * @constructor
 */
function AssetMap(app) {
	this.app = app;

	this.src = {
		folders: [],
		pages: []
	};

	this.assets = {};

	allAssetMapsArr.push(this);
}


AssetMap.prototype.setup = function (options) {
	this.uriProtocol  = options.uriProtocol;
	this.baseUrl      = options.baseUrl;
	this.cacheability = options.cacheability;
	this.profiles     = options.profiles;

	if (options.name) {
		this.name = options.name;

		// If not provided in options, load those from config
		this.uriProtocol  = this.uriProtocol  || mithril.core.config.get('module.assets.maps.' + this.name + '.uriProtocol');
		this.baseUrl      = this.baseUrl      || mithril.core.config.get('module.assets.maps.' + this.name + '.baseUrl');
		this.cacheability = this.cacheability || mithril.core.config.get('module.assets.maps.' + this.name + '.cacheability');
		this.profiles     = this.profiles     || mithril.core.config.get('module.assets.maps.' + this.name + '.profiles');
	}

	// Set up default values

	this.uriProtocol  = this.uriProtocol  || mithril.core.config.get('module.assets.uriProtocol', 'mui');
	this.baseUrl      = this.baseUrl      || mithril.core.config.get('module.assets.baseUrl', {});
	this.cacheability = this.cacheability || mithril.core.config.get('module.assets.cacheability', {});
	this.profiles     = this.profiles     || mithril.core.config.get('module.assets.profiles', {});

	// Cacheability rules from JSON are [String, Number] tuples, but we want [RegExp, Number].

	for (var context in this.cacheability) {
		var rules = this.cacheability[context],
			numRules = rules.length,
			newRules = [];

		// Order is reversed here, but we do the same when reading this array in getAssetsForConfig(),
		// so original order and rule precedence are preserved.

		while (numRules > 0) {
			var rule = rules[--numRules];
			newRules.push([new RegExp(rule[0]), rule[1]]);
		}

		this.cacheability[context] = newRules;
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
 * Get all asset maps that match provided names. If no name is provided, return all asset maps.
 * @param {?Array.<string>=} names Names of the asset maps we want to fetch.
 * @return {Object} Dictionary of asset maps. Unnamed ones get auto-generated names.
 */
AssetMap.query = function (names) {
	return allAssetMapsArr.reduce(function (returnMap, assetMap, index) {
		if (!names || names.indexOf(assetMap.name) !== -1) {
			returnMap[assetMap.name || 'unnamed_' + index] = assetMap;
		}

		return returnMap;
	}, {});
};


/**
 * Get all the assets requested by a client.
 * @param {Object} clientConfig Client's config object.
 * @param {Object} Dictionary of assets.
 */
AssetMap.prototype.getAssetsForConfig = function (clientConfig) {
	var myFiles = {};

	for (var context in this.assets) {
		var baseUrl = mithril.core.config.get('module.assets.baseUrl.' + context);

		if (baseUrl === null) {
			logger.error('No baseUrl found in configuration for context "' + context + '". Expected in: module.assets.baseUrl.' + context);
			continue;
		}

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

			var language = clientConfig.language;
			var localizedAsset = localizedAssets[language.toLowerCase()];

			if (!localizedAsset) {
				localizedAsset = localizedAssets['default'];

				if (!localizedAsset) {
					// The asset doesn't have a default.
					// It's most probably something that should have been translated, but wasn't.
					logger.error('Missing "' + language + '" translation for asset "' + identifier + '" in context "' + context + '". Asset not sent!');
					continue;
				}
			}

			// Get the best profile matching the config
			var numVariants = localizedAsset.length,
				best = null,
				bestScore = -1;

			while (numVariants > 0) {
				var variant = localizedAsset[--numVariants],
					clientMatchIf = variant.clientMatchIf;

				if (clientMatchIf && (clientConfig.density < clientMatchIf.density || clientConfig.screen < clientMatchIf.screen)) {
					continue;
				}

				// if clientMatchIf is not provided, score is just 0 (still better than the initial -1 value aforeset).
				var score = 0;

				if (clientMatchIf) {
					score = clientMatchIf.screen[0] * clientMatchIf.screen[1] * clientMatchIf.density * clientMatchIf.density;
				}

				if (score > bestScore) {
					best = variant;
					bestScore = score;
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


AssetMap.prototype.indexFolder = function (folder, cb) {
	var assetMap = this,
		localPath = path.join(path.dirname(process.mainModule.filename), folder),
		asyncTasks = 1,
		error;

	function done(err) {
		error = error || err;

		if (--asyncTasks === 0) {
			cb(error, assetMap);
		}
	}

	FolderTraversal.traverse(
		localPath,
		function (fn) {
			var m = ASSET_PATH_RE.exec(fn);
			if (!m) {
				return undefined;
			}

			var contextName = m[1];    // img, font, bgm, ...
			var languageId = m[2].toLowerCase(); // en, fr, nl
			var subFolders = m[3];     // directory in which basename sits (will contain a trailing slash)
			var basename = m[4];       // filename without file extension or profiles
			var profiles = m[5] ? m[5].split(',') : [];  // all profiles this asset can be used for (defaults to all profiles)
			var format = m[6].toLowerCase();  // file extension
			var descriptor = path.join(subFolders, basename);

			var obj = {
				path: fn.substring(contextName.length)
			};

			var context = assetMap.assets[contextName];
			if (!context) {
				context = assetMap.assets[contextName] = {};
			}

			var asset = context[descriptor];
			if (!asset) {
				asset = context[descriptor] = {};
			}

			var localizedAsset = asset[languageId];
			if (!localizedAsset) {
				localizedAsset = asset[languageId] = [];
			}

			obj.cacheability = assetMap.getCacheability(contextName, descriptor);

			var numProfiles = profiles.length,
				clientMatchIf = {
					density: 1,
					screen: [1, 1]
				},
				keepMatchIf = false;

			while (numProfiles > 0) {
				var profileName = profiles[--numProfiles],
					profile = assetMap.profiles[profileName];

				if (!profile) {
					logger.error('Unknown profile "' + profileName + '" found (path: "' + fn + '").');
					continue;
				}

				if (profile.density) {
					if (clientMatchIf.density < profile.density) {
						clientMatchIf.density = profile.density;
						keepMatchIf = true;
					}
				}

				if (profile.screen) {
					if (clientMatchIf.screen[0] < profile.screen[0]) {
						clientMatchIf.screen[0] = profile.screen[0];
						keepMatchIf = true;
					}

					if (clientMatchIf.screen[1] < profile.screen[1]) {
						clientMatchIf.screen[1] = profile.screen[1];
						keepMatchIf = true;
					}
				}
			}

			if (keepMatchIf) {
				obj.clientMatchIf = clientMatchIf;
			}
/*
			// it seems this was never used?
			if (profiles.length) {
				obj.profiles = profiles;
			}
*/
			obj.format = format;

			++asyncTasks;
			var shasum = crypto.createHash('sha1'),
				s = fs.ReadStream(path.join(localPath, fn));

			s.on('data', shasum.update.bind(shasum));

			s.on('end', function () {
				obj.digest = shasum.digest('hex').slice(0, 8);

				localizedAsset.push(obj);

				logger.debug('Added asset:', obj);

				done();
			});

			s.on('error', function (err) {
				done(err);
			});
		},
		function (errors) {
			done(errors);
		}
	);
};


AssetMap.prototype.indexPage = function (pageInfo) {
	var name = pageInfo.name;
	var context = pageInfo.context;
	var descriptor = pageInfo.descriptor;
	var path = pageInfo.path;

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
			digest: variant.digest,
			cacheability: this.getCacheability(context, descriptor)
		};

		localized.push(obj);
	}
};


AssetMap.prototype.reindex = function (cb) {
	var that = this;

	this.assets = {};

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
		},
	], cb);
};


/**
 * Scan the content of a folder, adding any encountered asset to the asset map.
 * @param {String}                     folder Folder path, relative to the app's folder.
 * @param {function(?Object, ?Object)} cb     Callback.
 */
AssetMap.prototype.addFolder = function (folder) {
	this.src.folders.push(folder);
};


/**
 */

AssetMap.prototype.addPage = function (context, descriptor, pageName, path) {
	path = path.substring(context.length);

	this.src.pages.push({ context: context, descriptor: descriptor, name: pageName, path: path });
};


// Asset map builder
function buildAssetMap(buildTarget, clientConfig, contextName, assetMap, cb) {
	logger.info('Building asset map');

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


// ******************* EXPORTS *********************

exports.setup = function (state, cb) {
	mithril.core.app.builders.add('assets', buildAssetMap);
	mithril.core.app.contexts.add('assetmap', 'text/assetmap; charset=utf8', '\n');
	cb();
};

// TODO: apparently this usercommand hasn't been used since mithril 0.4 and could just go away...
exports.getManageCommands = function () {
	return ['getAssetMaps'];
};

exports.AssetMap = AssetMap;


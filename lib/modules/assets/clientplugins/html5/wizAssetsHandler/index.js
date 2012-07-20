(function (window) {

	var mithril = window.mithril;

	if (!mithril) {
		return;
	}

	var mod = new mithril.EventEmitter();

	mithril.plugins.wizAssetsHandler = mod;


	// We cache based on ident, version, language and file extension. The only part we use from the real remote URL, is the file's extension.
	// When an asset gets a local URI to represent it, we set a new getURI() on the Asset object, to return the new local URI.

	function forEach(parallel, arr, fn, cb) {
		var i = 0, done = 0, len = arr.length, p, start, complete;

		if (len === 0 || parallel < 1) {
			if (cb) {
				cb();
			}
			return;
		}

		complete = function () {
			done += 1;

			if (done < len) {
				start();
			} else {
				if (cb) {
					cb();
					cb = null;
				}
			}
		};

		start = function () {
			if (i < len) {
				var item = arr[i];
				i += 1;

				fn(item, complete);
			}
		};

		// run fn in parallel

		if (parallel > len) {
			parallel = len;
		}

		for (p = 0; p < parallel; p++) {
			start();
		}
	}

	// Parses strings that look like "ja/1.5/some/ident/dad16357.foo"
	var CACHE_PATH_RE = /^([a-z]+)\/([0-9]+(?:\.[0-9]+)?)\/(.+?)\/([0-9a-f]+)(?:\.(\w*))?$/i;

	// Extracts the extension from a file path
	var EXTENSION_RE = /\/[^?\/]+?(?:\.(\w*))$/;


	function assetToCachePath(asset) {
		var m = EXTENSION_RE.exec(asset.relPath);

		return mithril.getLanguage() + '/' + mithril.getDensity() + '/' + asset.fullIdent + '/' + asset.digest + (m ? '.' + m[1] : '');
	}


	mod.assetToCachePath = assetToCachePath;


	function downloadFile(asset, cb) {
		if (!window.wizAssets) {
			// in simulation mode, we continue silently

			window.setTimeout(function () {
				cb();
			}, 0);
			return;
		}

		window.wizAssets.downloadFile(
			asset.getUrl(),
			assetToCachePath(asset),
			function (localUrl) {
				// remember the new URL inside of the asset

				if (localUrl) {
					//console.log('Downloaded', asset.getUrl(), 'to', localUrl);
					asset.overrideUrl(localUrl);
				} else {
					console.warn('Failure to download ' + asset.getUrl() + ' (but wrongfully received a success callback)');
				}

				cb();
			},
			function (error) {
				// error implications:
				// - some may be fatal (no example currently)
				// - some may warrant a retry (eg: timeout)
				// - some (or all?) may mean: continue with a partial cache (eg: disk full)

				console.warn(error);

				cb();
			}
		);
	}


	function DownloadPlan() {
		this.totalDownloads = 0;
		this.downloadProgress = 0;
		this.names = [];
		this.phases = {};

		this.setPhase('main', { parallel: 2 });
	}


	DownloadPlan.prototype.resetCounters = function () {
		this.totalDownloads -= this.downloadProgress;
		this.downloadProgress = 0;
	};


	DownloadPlan.prototype.setPhase = function (phaseName, options) {
		if (this.names.indexOf(phaseName) === -1) {
			// introduces a new phase to the system, set up defaults

			this.names.push(phaseName);
			this.phases[phaseName] = {
				parallel: 1,
				maxCacheability: Infinity,
				assets: []
			};
		}

		if (options) {
			// overwrite defaults

			for (var key in options) {
				this.phases[phaseName][key] = options[key];
			}
		}
	};


	DownloadPlan.prototype.registerAssets = function (assets) {
		var a, alen = assets.length, asset,
            p, plen = this.names.length, phases = [], phase;

		// sort names by maxCacheability, so highest level of detail is matched first

		for (p = 0; p < plen; p++) {
			phases.push(this.phases[this.names[p]]);
		}

		phases.sort(function (a, b) {
			return a.maxCacheability - b.maxCacheability;
		});

		this.totalDownloads += alen;

		// place each asset in a phase

		for (a = 0; a < alen; a++) {
			asset = assets[a];

			for (p = 0; p < plen; p++) {
				phase = phases[p];

				if (phase && asset.cacheability <= phase.maxCacheability) {
					if (phase.assets) {
						phase.assets.push(asset);
					} else {
						phase.assets = [asset];
					}
					break;
				}
			}
		}
	};


	DownloadPlan.prototype.runPhase = function (phaseName, cb) {
		var index = this.names.indexOf(phaseName);
		if (index === -1) {
			console.warn('No such phase:', phaseName);
			return cb();
		}

		var that = this;
		var phase = this.phases[phaseName];

		// remove the phase from existance, so it can not run more than once

		delete this.phases[phaseName];
		this.names.splice(index, 1);

		// start downloading

		mod.emit('phaseStart', phaseName, phase.assets);

		forEach(
			phase.parallel || 1,
			phase.assets,
			function (asset, callback) {
				// download the asset

				mod.emit('beforeDownloadFile', that.downloadProgress + 1, that.totalDownloads, asset);

				downloadFile(asset, function () {
					that.downloadProgress += 1;

					mod.emit('afterDownloadFile', that.downloadProgress, that.totalDownloads, asset);

					callback();
				});
			},
			function (error) {
				// phase completed

				mod.emit('phaseComplete', phaseName, phase.assets);

				cb();
			}
		);
	};


	DownloadPlan.prototype.runRemainingPhases = function (cb) {
		var that = this;

		forEach(
			1,
			this.names.slice(),
			function (phaseName, callback) {
				that.runPhase(phaseName, callback);
			},
			cb
		);
	};


	DownloadPlan.prototype.runAllPhases = function (cb) {
		// check if there's nothing to download, in which case we emit a special event

		if (this.totalDownloads === 0) {
			mod.emit('uptodate');

			return cb();
		}


		// start the downloads

		var that = this;

		var summary = {};

		for (var i = 0, len = this.names.length; i < len; i++) {
			var name = this.names[i];
			var phase = this.phases[name];

			summary[name] = phase.assets;
		}

		mod.emit('downloadsStart', that.totalDownloads, summary);

		this.runRemainingPhases(function () {
			mod.emit('downloadsComplete', that.totalDownloads, summary);

			cb();
		});
	};


	// setup function to override default behavior

	var downloadPlan = new DownloadPlan();


	mod.setup = function (phaseName, opts) {
		downloadPlan.setPhase(phaseName, opts);
	};


	function deleteFiles(list, callback) {
		if (!list || list.length === 0) {
			return callback();
		}

		window.wizAssets.deleteFiles(
			list,
			function () {
				window.wizAssets.purgeEmptyDirectories(
					callback,
					function (error) {
						console.warn('wizAssets.purgeEmptyDirectories failed:', error);
						callback();
					}
				);
			},
			function (error) {
				console.warn('wizAssets.deleteFiles failed:', error);
				callback(error);
			}
		);
	}


	function getCacheMap(cb) {
		if (!window.wizAssets) {
			console.warn('wizAssets not found, going into simulation mode.');
			return cb(null, {});
		}

		window.wizAssets.getFileURIs(
			function (cacheMap) {
				cb(null, cacheMap);
			},
			function (errorCode, info) {
				// getFileURIs failure callback
				// pretend everything was fine by emitting uptodate, and just continue

				console.warn(errorCode, info);

				cb(errorCode);
			}
		);
	}

	// run on manual control: analyze, deleteFiles, downloadPlan
	// ---------------------------------------------------------

	mod.getDownloadPlan = function () {
		return downloadPlan;
	};


	// analyze:
	// - sets local URLs on assets that are available
	// - sets up assets to download in the downloadPlan object
	// - yields a deleteList and the global downloadPlan

	function createDeleteList(cacheMap) {
		var key, path, m, fullIdent, digest, density, language, asset;
		var list = [];

		var currentLanguage = mithril.getLanguage();
		var currentDensity = mithril.getDensity();

		for (path in cacheMap) {
			key = path;

			// strip leading slash

			if (path[0] === '/') {
				path = path.substring(1);
			}

			m = path.match(CACHE_PATH_RE);
			if (m) {
				language = m[1];
				density = Number(m[2]);
				fullIdent = m[3];
				digest = m[4];

				// Keep the file if either its language or density doesn't match the current settings,
				// but are supported by the app
				if ((language !== currentLanguage && mithril.appVariants.languages.indexOf(language) !== -1) ||
					(density !== currentDensity && mithril.appVariants.densities.indexOf(density) !== -1)) {
					continue;
				}

				asset = mithril.assets.getAsset(fullIdent);

				// Keep unless the asset isn't in the assetmap anymore, or digest is different
				if (asset && asset.digest === digest) {
					continue;
				}
			}

			list.push(cacheMap[key]);
		}

		return list;
	}


	mod.analyze = function (cb) {
		if (!mithril.assets) {
			var error = new Error('Mithril assets module not found, skipping WizAssetsHandler.');

			console.warn(error);
			return cb(error);
		}

		// check for the phonegap plugin

		mod.emit('checking');

		getCacheMap(function (error, currentCacheMap) {
			if (error) {
				// getFileURIs failure callback
				// pretend everything was fine by emitting uptodate

				mod.emit('uptodate');

				return cb(error);
			}

			// currentCacheMap: { "img/ui/loading-v1-U.gif": "file://localhost/etc...gif", ... }

			var downloadList = [];
			var deleteList;
			var assetList;
			var asset, cachePath;

			// mark each cached file for deletion, if it is not mentioned in our asset map
			// AND if language and density match.

			deleteList = createDeleteList(currentCacheMap);

			// make a download list for each file in our asset list that is not yet in our cache

			assetList = mithril.assets.getAllCacheable();

			for (var i = 0, len = assetList.length; i < len; i++) {
				asset = assetList[i];
				cachePath = assetToCachePath(asset);

				var foundUrl = currentCacheMap[cachePath];

				if (foundUrl) {
					asset.overrideUrl(foundUrl);
				} else {
					downloadList.push(asset);
				}
			}

			// calculate which assets need to be downloaded in which phase

			downloadPlan.registerAssets(downloadList);

			// yield the downloadPlan and deleteList

			cb(null, deleteList, downloadPlan);
		});
	};


	mod.deleteFiles = function (list, cb) {
		deleteFiles(list, cb);
	};


	mod.deleteAllFiles = function (cb) {
		// removes all files (useful for testing, but that's it)

		getCacheMap(function (error, cacheMap) {
			if (error) {
				// getFileURIs failure callback
				return cb(error);
			}

			// currentCacheMap: { "img/ui/loading-v1-U.gif": "file://localhost/etc...gif", ... }

			var deleteList = [];

			for (var key in cacheMap) {
				deleteList.push(cacheMap[key]);
			}

			console.warn('Deleting', deleteList.length, 'files...');

			deleteFiles(deleteList, cb);
		});
	};


	// run on the auto-pilot
	// ---------------------

	mod.run = function (cb) {
		mod.analyze(function (error, deleteList, downloadPlan) {
			if (error) {
				return cb(error);
			}

			// delete unused files

			deleteFiles(deleteList, function (error) {
				// ignore errors

				// download new files

				downloadPlan.runAllPhases(cb);
			});
		});
	};

}(window));


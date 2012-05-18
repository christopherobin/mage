(function () {
	var mithril = window.mithril;

	if (!mithril) {
		return;
	}

	var mod = new mithril.EventEmitter();

	mithril.plugins.wizAssetsHandler = mod;


	// We cache based on ident, version, language and file extension. The only part we use from the real remote URL, is the file's extension.
	// When an asset gets a local URI to represent it, we set a new getURI() on the Asset object, to return the new local URI.

	var wizAssets;

	// Parses strings that look like "ja/1.5/some/ident/dad16357.foo"
	var CACHE_PATH_RE = /^([a-z]+)\/([0-9]+(?:\.[0-9]+)?)\/(.+?)\/([0-9a-f]+)(?:\.(\w*))?$/i;
	// Extracts the extension from a file path
	var EXTENSION_RE = /\/[^?\/]+?(?:\.(\w*))$/;


	function parseCachePath(path) {
		// yields an ident, a version, and a language

		// strip leading slash

		if (path[0] === '/') {
			path = path.substring(1);
		}


		var m = CACHE_PATH_RE.exec(path);
		if (m === null) {
			return null;
		}

		return {
			language: m[1],
			density: Number(m[2]),
			fullIdent: m[3],
			digest: m[4],
			extension: m[4] || ''
		};
	}


	function assetToCachePath(asset) {
		var m = EXTENSION_RE.exec(asset.relPath);
		return mithril.getLanguage() + '/' + mithril.getDensity() + '/' + asset.fullIdent + '/' + asset.digest + (m ? '.' + m[1] : '');
	}

	mod.assetToCachePath = assetToCachePath;


	function downloadFile(asset, callback) {
		var url = asset.getUrl(),
			cachePath = assetToCachePath(asset);
		wizAssets.downloadFile(
			url,
			cachePath,
			function (localUrl) {
				// remember the new URL inside of the asset

				if (localUrl) {
					asset.overrideUrl(localUrl);
				} else {
					console.warn('Failure to download ' + asset.getUrl() + ' (but wrongfully received a success callback)');
				}

				callback();
			},
			function (error) {
				// error implications:
				// - some may be fatal (no example currently)
				// - some may warrant a retry (eg: timeout)
				// - some (or all?) may mean: continue with a partial cache (eg: disk full)

				console.warn(error);

				callback();
			}
		);
	}


	// default behaviors, per phase

	var phases = ['main'];

	var options = {
		main: {
			parallel: 2,
			maxCacheability: Infinity
		}
	};


	// setup function to override default behavior

	mod.setup = function (phaseName, opts) {
		if (phases.indexOf(phaseName) === -1) {
			// introduces a new phase to the system, set up defaults

			phases.push(phaseName);
			options[phaseName] = { parallel: 1, maxCacheability: Infinity };
		}

		// overwrite defaults

		for (var key in opts) {
			options[phaseName][key] = opts[key];
		}
	};


	function forEach(parallel, arr, fn, cb) {
		var i = 0, len = arr.length, p, callback;

		if (len === 0 || parallel < 1) {
			return cb();
		}

		callback = function () {
			var item = arr[i];

			i += 1;

			if (i > len) {
				// finished

				if (cb) {
					cb();
					cb = null;
				}
			} else {
				fn(item, callback);
			}
		};

		// run fn in parallel

		if (parallel > len) {
			parallel = len;
		}

		for (p = 0; p < parallel; p++) {
			callback();
		}
	}


	function setupPhases(assets) {
		var resultMap = {},
            a, alen = assets.length, asset,
            p, plen = phases.length, phaseName, o;

		// place each asset in a phase

		for (a = 0; a < alen; a++) {
			asset = assets[a];

			for (p = 0; p < plen; p++) {
				phaseName = phases[p];
				o = options[phaseName];

				if (o && asset.cacheability <= o.maxCacheability) {
					if (!resultMap[phaseName]) {
						resultMap[phaseName] = [asset];
					} else {
						resultMap[phaseName].push(asset);
					}
					break;
				}
			}
		}

		return resultMap;
	}


	function downloadFiles(list, cb) {
		// calculate which assets need to be downloaded in which phase

		var phaseAssets = setupPhases(list);


		// calculate the total number of files to download

		var totalDownloads = 0, downloadProgress = 0;

		for (var phaseName in phaseAssets) {
			totalDownloads += phaseAssets[phaseName].length;
		}


		// check if there's nothing to download, in which case we emit a special event

		if (totalDownloads === 0) {
			mod.emit('uptodate');

			return cb();
		}


		// start the downloads

		mod.emit('downloadsStart', totalDownloads, phaseAssets);

		forEach(
			1,
			phases,
			function (phaseName, callback) {
				// execute a new phase with a specific parallelism

				var assets = phaseAssets[phaseName] || [];
				var o = options[phaseName];

                mod.emit('phaseStart', phaseName, assets);

				forEach(
					o.parallel || 1,
					assets,
					function (asset, subcallback) {
						// download the asset

						mod.emit('beforeDownloadFile', downloadProgress + 1, totalDownloads, asset);

						downloadFile(asset, function () {
							downloadProgress += 1;

							mod.emit('afterDownloadFile', downloadProgress, totalDownloads, asset);

							subcallback();
						});
					},
					function (error) {
						// phase completed

						mod.emit('phaseComplete', phaseName, assets);

						window.setTimeout(callback, 0);  // timeout to clear the call stack
					}
				);
			},
			function () {
				mod.emit('downloadsComplete', totalDownloads, phaseAssets);

				cb();
			}
		);
	}


	function deleteFiles(list, callback) {
		if (!list || list.length === 0) {
			return callback();
		}

		wizAssets.deleteFiles(
			list,
			function () {
				wizAssets.purgeEmptyDirectories(
					callback,
					function (error) {
						console.warn('wizAssets.purgeEmptyDirectories failed:', error);
						callback();
					}
				);
			},
			function (error) {
				console.warn('wizAssets.deleteFiles failed:', error);
				callback();
			}
		);
	}


	// read cached assets

	mod.run = function (cb) {
		// access the phonegap plugin

		wizAssets = window.wizAssets;

		if (!wizAssets) {
			console.warn('wizAssets not found, skipping WizAssetsHandler.');
			return cb();
		}

		if (!mithril.assets) {
			console.warn('Mithril assets module not found, skipping WizAssetsHandler.');
			return cb();
		}

		mod.emit('checking');
		var currentLanguage = mithril.getLanguage(),
			currentDensity  = mithril.getDensity();

		wizAssets.getFileURIs(function (currentCacheMap) {
			// currentCacheMap: { "img/ui/loading-v1-U.gif": "file://localhost/etc...gif", ... }

			var downloadList = [];
			var deleteList = [];
			var asset, cachePath;

			// mark each cached file for deletion, if it is not mentioned in our asset map
			// AND if language and density match.

			for (cachePath in currentCacheMap) {
				var entry = parseCachePath(cachePath);

				if (entry) {
					// Keep the file if either its language or density doesn't match the current settings,
					// but are supported by the app
					if ((entry.language !== currentLanguage && mithril.appVariants.languages.indexOf(entry.language) !== -1) ||
						(entry.density !== currentDensity && mithril.appVariants.densities.indexOf(entry.density) !== -1)) {
						continue;
					}

					asset = mithril.assets.getAsset(entry.fullIdent);

					// Keep unless the asset isn't in the assetmap anymore, or digest is different
					if (asset && asset.digest === entry.digest) {
						continue;
					}
				}
				// add the file's local URI to the deleteList
				deleteList.push(currentCacheMap[cachePath]);
			}

			// make a download list for each file in our asset list that is not yet in our cache

			var assetList = mithril.assets.getAllCacheable();

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

			// delete files on deleteList

			deleteFiles(deleteList, function () {

				// download files on downloadList

				downloadFiles(downloadList, cb);
			});
		}, function (errorCode, info) {
			// getFileURIs failure callback
			// pretend everything was fine, and just continue

			console.warn(errorCode, info);

			mod.emit('uptodate');

			cb();
		});
	};

}());


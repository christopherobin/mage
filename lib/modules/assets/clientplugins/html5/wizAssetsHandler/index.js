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


	function parseCachePath(path) {
		// yields an ident, a version, and a language

		// strip leading slash

		if (path[0] === '/') {
			path = path.substring(1);
		}

		var m = path.match(/^(.+?)-v([0-9]+)-([A-Z]+)(\.[a-zA-Z0-9]+)?$/);
		if (m) {
			return {
				fullIdent: m[1],
				version: m[2],
				language: (m[3] === 'U') ? null : m[3],
				extension: m[4] || ''
			};
		}

		return null;
	}


	function assetToCachePath(asset) {
		var m = asset.relPath.match(/\.[a-zA-Z0-9]+$/);
		var extension = m ? m[0] : '';

		return asset.fullIdent + '-v' + asset.version + '-' + (asset.language || 'U') + extension;
	}

	mod.assetToCachePath = assetToCachePath;


	var downloadProgress = 0;

	function downloadFile(asset, total, callback) {
		mod.emit('beforeDownloadFile', downloadProgress + 1, total, asset);

		wizAssets.downloadFile(
			asset.getUrl(),
			assetToCachePath(asset),
			function (localUrl) {
				asset.overrideUrl(localUrl);

				mod.emit('afterDownloadFile', ++downloadProgress, total, asset);

				callback();
			},
			function (error) {
				// error implications:
				// - some may be fatal (no example currently)
				// - some may warrant a retry (eg: timeout)
				// - some (or all?) may mean: continue with a partial cache (eg: disk full)

				console.warn(error);

				mod.emit('afterDownloadFile', ++downloadProgress, total, asset);

				callback();
			}
		);
	}


	function downloadFiles(list, parallel, callback) {
		var totalDownloads = list.length;
		var remainingDownloads = totalDownloads;
		var activeDownloads = 0;	// number of concurrent downloads taking place
		var index = -1;

		downloadProgress = 0;

		if (remainingDownloads === 0) {
			mod.emit('uptodate');

			return callback();
		}

		mod.emit('downloadsStart', totalDownloads);

		(function next() {
			index += 1;

			var asset = list[index];
			if (asset) {
				activeDownloads++;

				downloadFile(asset, totalDownloads, function () {
					activeDownloads--;
					remainingDownloads--;

					if (remainingDownloads === 0) {
						mod.emit('downloadsComplete', totalDownloads);

						callback();
					} else {
						next();
					}
				});

				if (activeDownloads < parallel) {
					next();
				}
			}
		}());
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

		wizAssets.getFileURIs(function (currentCacheMap) {
			// currentCacheMap: { "img/ui/loading-v1-U.gif": "file://localhost/etc...gif", ... }

			var downloadList = [];
			var deleteList = [];
			var asset, cachePath;

			// mark each cached file for deletion, if it is not mentioned in our asset map

			for (cachePath in currentCacheMap) {
				var entry = parseCachePath(cachePath);

				if (entry) {
					asset = mithril.assets.getAsset(entry.fullIdent);

					if (!asset || asset.version !== entry.version || asset.language !== entry.language) {
						// add the file's local URI to the deleteList

						deleteList.push(currentCacheMap[cachePath]);
					}
				}
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

				downloadFiles(downloadList, 2, function () {
					cb();
				});
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


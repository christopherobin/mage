(function () {
	var mithril = window.mithril;

	if (!mithril || !mithril.assets) {
		console.warn('Mithril assets module not found, skipping WizAssetsHandler');
		return;
	}

	var mod = {};

	mithril.assets.registerAssetsHandler(mod);


	// Event system

	var listeners = {};

	mod.on = function (eventName, fn) {
		if (listeners.hasOwnProperty(eventName)) {
			listeners[eventName].push(fn);
		} else {
			listeners[eventName] = [];
		}
	};


	function emit(eventName) {
		var handlers = listeners[eventName];

		var args = [].concat(arguments);
		args.shift();

		if (handlers) {
			for (var i = 0, len = handlers.length; i < len; i++) {
				handlers[i].apply(null, args);
			}
		}
	}


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


	function downloadFile(list, index, callback) {
		var asset = list[index];
		if (!asset) {
			// end of list, we're done

			emit('downloadsComplete', list.length);

			return callback();
		}

		var sourceUrl = asset.getUrl();

		emit('beforeDownloadFile', index, list.length, asset);

		wizAssets.downloadFile(
			asset.getUrl(),
			assetToCachePath(asset),
			function (localUrl) {
				asset.overrideUrl(localUrl);

				emit('afterDownloadFile', index, list.length, asset);

				// download next file

				downloadFile(list, index + 1, callback);
			},
			function (error) {
				// error implications:
				// - some may be fatal (no example currently)
				// - some may warrant a retry (eg: timeout)
				// - some (or all?) may mean: continue with a partial cache (eg: disk full)

				console.warn(error);

				emit('afterDownloadFile', index, list.length, asset);

				// download next file

				downloadFile(list, index + 1, callback);
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
			return cb();
		}


		emit('checking');

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

			var assetList = mithril.assets.getAll();

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

				// if the list is empty, all is up-to-date, and we're done

				if (downloadList.length === 0) {
					// todo: emit event "assetsUpToDate"

					emit('uptodate');

					return cb();
				}

				// download the files and emit progress

				emit('downloadsStart', downloadList.length);

				downloadFile(downloadList, 0, function (error) {
					if (error) {
						// todo: emit event "assetsDownloadError"
					} else {
						// todo: emit event "assetsDownloadDone"
					}

					// continue

					cb();
				});
			});
		}, function (errorCode, info) {
			// getFileURIs failure callback
			// pretend everything was fine, and just continue

			console.warn(errorCode, info);

			emit('uptodate');

			cb();
		});
	};

}());


(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.assets.construct'));

	var encodeURI = window.encodeURI;


	// asset prototype

	function Asset(context, ident, delimiter, baseUrl, relPath, version, language, cacheability) {
		var parts = ident.split(delimiter);

		relPath = relPath.replace(/\$([0-9]+)/g, function (m) {
			return (m[1] === '0') ? ident : parts[m[1] - 1];
		});

		this.fullIdent = context + '/' + ident;
		this.baseUrl = baseUrl;
		this.relPath = relPath;
		this.version = version;
		this.language = language;
		this.cacheability = cacheability;
	}


	Asset.prototype.getUrl = function () {
		if (this.url) {
			return encodeURI(this.url);
		}

		return encodeURI(this.baseUrl + this.relPath) + '?v' + this.version;
	};


	Asset.prototype.overrideUrl = function (url) {
		this.url = url;
	};


	// assets module api

	var assets = [];
	var assetsByIdent = {};


	mod.getAsset = function (ident) {
		return assetsByIdent[ident] || null;
	};


	mod.get = function (ident) {
		var asset = assetsByIdent[ident];

		if (asset) {
			return asset.getUrl();
		}

		console.warn('Asset', ident, 'not found.');
		return '';
	};


	mod.getAllCacheable = function () {
		// returns an array of assets, sorted by cacheability (most cacheable first), with uncacheble assets filtered out

		var result = [];

		// filter out uncacheable assets (negative cacheability)

		for (var i = 0, len = assets.length; i < len; i++) {
			var asset = assets[i];

			if (asset.cacheability >= 0) {
				result.push(asset);
			}
		}

		// sort by cacheability (lowest first)

		result.sort(function (a, b) {
			return a.cacheability - b.cacheability;
		});

		return result;
	};


	mod.getAll = function () {
		return assets;
	};


	mod.getAllByIdent = function () {
		return assetsByIdent;
	};


	mod.applyAssetMapToContent = function (content) {
		if (!content) {
			return content;
		}

		return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
			return mod.get(uri.substring(6));
		});
	};


	function registerContextualLookup(context) {
		if (context in mod) {
			// the contextual lookup already exists, which may happen when we apply multiple asset maps
			return;
		}

		mod[context] = function (ident) {
			return mod.get(context + '/' + ident);
		};
	}


	mod.init = function (assetMap) {
		// create asset objects

		var delimiter = assetMap.descriptorDelimiter;

		// create assets for each entry

		for (var context in assetMap.assets) {
			// register a quick lookup function for this context

			registerContextualLookup(context);

			// register assets

			var baseUrl = assetMap.assets[context].baseUrl;
			var map = assetMap.assets[context].map;

			for (var ident in map) {
				var entry = map[ident].split('\t');	// relPath, version, language, cacheability
				var relPath = entry[0];
				var version = entry[1] || '1';
				var language = entry[2] || null;
				var cacheability = +entry[3];

				var asset = new Asset(context, ident, delimiter, baseUrl, relPath, version, language, cacheability);

				assets.push(asset);
				assetsByIdent[asset.fullIdent] = asset;
			}
		}
	};


	mod.setup = function (cb) {
		if (!mithril.loader) {
			console.warn('Mithril loader not available, so no assets to initialize.');
			return cb();
		}

		var assetMaps = mithril.loader.getDownloadedParts('text/assetmap');

		var error;

		for (var i = 0, len = assetMaps.length; i < len; i++) {
			try {
				mod.init(JSON.parse(assetMaps[i]));
			} catch (e) {
				console.error('Error while parsing asset map:', e);
				error = 'parseError';
			}
		}

		cb(error);
	};

}());

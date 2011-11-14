(function () {

	if (!window.mithril) {
		window.mithril = {};
	}

	var mithril = window.mithril;

	var mod = {
		assetsHandler: null
	};

	mithril.assets = mod;

	var encodeURI = window.encodeURI;


	// asset prototype

	function Asset(context, ident, delimiter, baseUrl, relPath, version, language) {
		var parts = ident.split(delimiter);

		relPath = relPath.replace(/\$([0-9]+)/g, function (m) {
			return (m[1] === '0') ? ident : parts[m[1] - 1];
		});

		this.fullIdent = context + '/' + ident;
		this.baseUrl = baseUrl;
		this.relPath = relPath;
		this.version = version || '1';
		this.language = language || null;
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
			console.warn('Tried to register ' + context + ' as a contextual lookup, but key already existed.');
			return;
		}

		mod[context] = function (ident) {
			return mod.get(context + '/' + ident);
		};
	}


	mod.registerAssetsHandler = function (handler) {
		mod.assetsHandler = handler;
	};


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
				var entry = map[ident].split('\t');	// relPath, version, (language)
				var relPath = entry[0];
				var version = entry[1];
				var language = entry[2] || null;

				var asset = new Asset(context, ident, delimiter, baseUrl, relPath, version, language);

				assets.push(asset);
				assetsByIdent[asset.fullIdent] = asset;
			}
		}
	};

}());
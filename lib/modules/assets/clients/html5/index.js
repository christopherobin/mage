(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.assets.construct'));

	var encodeURI = window.encodeURI;


	// asset prototype

	function Asset(context, ident, delimiter, baseUrl, relPath, version, language, cacheability) {
		if (arguments.length === 0) {
			// useful for deserialization

			context = ident = baseUrl = relPath = version = language = '';
			cacheability = 0;
		} else {
			var parts = ident.split(delimiter);

			relPath = relPath.replace(/\$([0-9]+)/g, function (m) {
				return (m[1] === '0') ? ident : parts[m[1] - 1];
			});
		}

		this.fullIdent = context + '/' + ident;
		this.baseUrl = baseUrl;
		this.relPath = relPath;
		this.version = version;
		this.language = language;
		this.cacheability = cacheability;
	}


	Asset.prototype.toJSON = function () {
		return [this.fullIdent, this.baseUrl, this.relPath, this.version, this.language, this.cacheability];
	};


	Asset.fromParsedJSON = function (obj) {
		var asset = new Asset();
		asset.fullIdent = obj[0];
		asset.baseUrl = obj[1];
		asset.relPath = obj[2];
		asset.version = obj[3];
		asset.language = obj[4];
		asset.cacheability = obj[5];
		return asset;
	};


	Asset.prototype.getUrl = function () {
		if (this.url) {
			return encodeURI(this.url);
		}

		return encodeURI(this.baseUrl + this.relPath) + '?v' + this.version;
	};


	Asset.prototype.overrideUrl = function (url) {
		this.url = url;
	};


	Asset.prototype.getContents = function (options, cb) {
		if (!mithril.io || !mithril.io.transports || !mithril.io.transports.http) {
			return cb(new Error('Cannot get asset contents without a registered HTTP transport.'));
		}

		var HttpRequest = mithril.io.transports.http;
		var req = new HttpRequest(options);

		req.send('GET', this.getUrl(), null, null, null, cb);
	};


	// assets module api

	var assets = [];
	var assetsByIdent = {};
	var assetsByContext = {};


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


	mod.getAllFromContext = function (name) {
		return assetsByContext[name] || [];
	};


	mod.getAllByIdent = function () {
		return assetsByIdent;
	};


	var CSSStyleSheet = window.CSSStyleSheet;
	var StyleSheetList = window.StyleSheetList;


	mod.applyAssetMapToContent = function (content) {
		if (!content) {
			return content;
		}

		var i, len;

		if (typeof content === 'string') {
			return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
				return mod.get(uri.substring(6));
			});
		} else if (content instanceof CSSStyleSheet) {
			var rules = content.rules;

			for (i = 0, len = rules.length; i < len; i++) {
				var style = rules[i].style;

				if (style.backgroundImage) {
					style.backgroundImage = mod.applyAssetMapToContent(style.backgroundImage);
				}

				if (style.src) {
					style.src = mod.applyAssetMapToContent(style.src);
				}
			}
		} else if (content instanceof StyleSheetList) {
			for (i = 0, len = content.length; i < len; i++) {
				mod.applyAssetMapToContent(content[i]);
			}
		}
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
				var entry = map[ident].split('\t');	// relPath, version, language, cacheability (tab count is guaranteed)
				var relPath = entry[0];
				var version = entry[1] || '1';    // defaults to 1
				var language = entry[2] || null;  // defaults to null
				var cacheability = +entry[3];     // defaults to 0

				var asset = new Asset(context, ident, delimiter, baseUrl, relPath, version, language, cacheability);

				assets.push(asset);
				assetsByIdent[asset.fullIdent] = asset;

				if (assetsByContext[context]) {
					assetsByContext[context].push(asset);
				} else {
					assetsByContext[context] = [asset];
				}
			}
		}
	};


	mod.serialize = function () {
		// returns a JSONifyable representation of all known assets
		// unserialize() can take this as input

		return assetsByContext;
	};


	mod.unserialize = function (parsed) {
		// accepts a JSON string and parses it into new Asset objects
		// does not overwrite existing assets

		var context, assetList, asset, i, len;

		for (context in parsed) {
			// register a quick lookup function for this context

			registerContextualLookup(context);

			// register assets

			assetList = parsed[context];

			for (i = 0, len = assetList.length; i < len; i++) {
				asset = Asset.fromParsedJSON(assetList[i]);

				if (!assetsByIdent[asset.fullIdent]) {
					assets.push(asset);
					assetsByIdent[asset.fullIdent] = asset;

					if (assetsByContext[context]) {
						assetsByContext[context].push(asset);
					} else {
						assetsByContext[context] = [asset];
					}
				}
			}
		}
	};


	mod.setup = function (cb) {
		if (!mithril.loader) {
			console.warn('Mithril loader not available, so no assets to initialize on module setup.');
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

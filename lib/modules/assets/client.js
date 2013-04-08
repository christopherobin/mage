var mageLoader = require('loader');
var HttpRequest = require('msgServer').transports.http;

// asset prototype

function Asset(fullIdent, url, relPath, digest, cacheability) {
	this.fullIdent    = fullIdent || '';
	this.url          = url || '';
	this.relPath      = relPath || '';
	this.digest       = digest || '';
	this.cacheability = cacheability || 0;
}


Asset.prototype.toJSON = function () {
	return [
		this.fullIdent,
		this.url,
		this.relPath,
		this.digest,
		this.cacheability
	];
};


Asset.fromParsedJSON = function (obj) {
	return new Asset(obj[0], obj[1], obj[2], obj[3], obj[4]);
};


Asset.prototype.getUrl = function () {
	return this.url;
};


Asset.prototype.overrideUrl = function (url) {
	this.url = encodeURI(url);
};


Asset.prototype.getContents = function (options, cb) {
	var req = new HttpRequest(options);

	req.send('GET', this.getUrl(), null, null, null, cb);
};


// assets module api

var assets = [];
var assetsByIdent = {};
var assetsByContext = {};


exports.getAsset = function (ident) {
	return assetsByIdent[ident] || null;
};


exports.get = function (ident) {
	var asset = assetsByIdent[ident];

	if (asset) {
		return asset.getUrl();
	}

	console.warn('Asset', ident, 'not found.');
	return '';
};


exports.getAllCacheable = function () {
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


exports.getAll = function () {
	return assets;
};


exports.getAllFromContext = function (name) {
	return assetsByContext[name] || [];
};


exports.getAllByIdent = function () {
	return assetsByIdent;
};


var CSSStyleSheet = window.CSSStyleSheet;
var StyleSheetList = window.StyleSheetList;


function applyAssetMapToString(str) {
	return str.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
		return exports.get(uri.substring(6));
	});
}

function applyAssetMapToStylesheet(content) {
	var rules = content.rules;
	var props = ['backgroundImage', 'webkitBorderImage', 'borderImage', 'src'];

	var i, len = rules.length;
	var p, plen = props.length;

	for (i = 0; i < len; i++) {
		var style = rules[i].style;

		if (style) {
			for (p = 0; p < plen; p++) {
				var prop = props[p];
				var str = style[prop];

				if (str) {
					style[prop] = applyAssetMapToString(str);
				}
			}
		}
	}

	return content;
}

function applyAssetMapToStylesheetList(content) {
	for (var i = 0, len = content.length; i < len; i++) {
		applyAssetMapToStylesheet(content[i]);
	}

	return content;
}


exports.applyAssetMapToContent = function (content) {
	if (!content) {
		return content;
	}

	if (typeof content === 'string') {
		return applyAssetMapToString(content);
	}

	if (content instanceof CSSStyleSheet) {
		return applyAssetMapToStylesheet(content);
	}

	if (content instanceof StyleSheetList) {
		return applyAssetMapToStylesheetList(content);
	}
};


function registerContextualLookup(context) {
	if (exports[context]) {
		// the contextual lookup already exists, which may happen when we apply multiple asset maps
		return;
	}

	exports[context] = function (ident) {
		return exports.get(context + '/' + ident);
	};
}


exports.init = function (assetMap) {
	var context, assetsInContext, baseUrl, map, ident, entry, fullIdent, relPath, digest, cacheability, url, asset;

	// create assets for each entry

	for (context in assetMap.assets) {
		// register a quick lookup function for this context

		registerContextualLookup(context);

		// set up the assetsByContext lookup map for this context

		assetsInContext = assetsByContext[context];

		if (!assetsInContext) {
			assetsInContext = assetsByContext[context] = [];
		}

		// register assets

		baseUrl = assetMap.assets[context].baseUrl;
		map = assetMap.assets[context].map;

		for (ident in map) {
			fullIdent    = context + '/' + ident;

			if (assetsByIdent[fullIdent]) {
				continue;
			}

			entry        = map[ident];
			relPath      = entry[0];
			digest       = entry[1];
			cacheability = entry[2];
			url          = encodeURI(baseUrl + relPath) + '?' + digest;
			asset        = new Asset(fullIdent, url, relPath, digest, cacheability);

			assets.push(asset);
			assetsByIdent[asset.fullIdent] = asset;
			assetsInContext.push(asset);
		}
	}
};


exports.serialize = function () {
	// returns a JSONifyable representation of all known assets
	// unserialize() can take this as input

	return assetsByContext;
};


exports.unserialize = function (parsed) {
	// accepts a JSON string and parses it into new Asset objects
	// does not overwrite existing assets

	var context, assetList, assetsInContext, asset, i, len;

	for (context in parsed) {
		// register a quick lookup function for this context

		registerContextualLookup(context);

		// set up the assetsByContext lookup map for this context

		assetsInContext = assetsByContext[context];

		if (!assetsInContext) {
			assetsInContext = assetsByContext[context] = [];
		}

		// register assets

		assetList = parsed[context];

		for (i = 0, len = assetList.length; i < len; i++) {
			asset = Asset.fromParsedJSON(assetList[i]);

			if (!assetsByIdent[asset.fullIdent]) {
				assets.push(asset);
				assetsByIdent[asset.fullIdent] = asset;
				assetsInContext.push(asset);
			}
		}
	}
};


exports.setup = function (cb) {
	if (!mageLoader) {
		console.warn('MAGE loader not available, so no assets to initialize on module setup.');
		return cb();
	}

	var assetMaps = mageLoader.getDownloadedParts('text/assetmap');

	var error;

	for (var i = 0, len = assetMaps.length; i < len; i++) {
		try {
			exports.init(JSON.parse(assetMaps[i]));
		} catch (e) {
			console.error('Error while parsing asset map:', e);
			error = 'parseError';
		}
	}

	mageLoader.registerAssetsModule(this);

	cb(error);
};

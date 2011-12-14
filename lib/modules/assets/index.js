var mithril = require('../../mithril');

exports.getManageCommands = function () {
	return ['getAssetMaps'];
};

var allAssetMapsArr = [];


exports.setup = function (state, cb) {
	mithril.core.app.builders.add('assets', function (buildTarget, language, contextName, assetMap, cb) {
		mithril.core.logger.info('Building asset map');

		if (assetMap) {
			cb(null, JSON.stringify(assetMap.getTranslationMap(language)));
		} else {
			mithril.core.logger.error('No asset map registered on app', buildTarget.describe());
			cb('noAssetMap');
		}
	});

	mithril.core.app.contexts.add('assetmap', 'text/assetmap; charset=utf8', '\n');

	cb();
};


function mapPathRule(descriptor, path) {
	var descParts = descriptor.split('/');

	return path.replace(/\$([0-9]+)/g, function (m) {
		return (m[1] === '0') ? descriptor : descParts[m[1] - 1];
	});
}


function AssetMap(options) {
	options = options || {};

	this.assets = {};
	this.uriProtocol = options.uriProtocol || 'mui';
	this.baseUrl = options.baseUrls || mithril.core.config.get('module.assets.baseUrl') || {};
	if (options.name) {
		this.name = options.name;
	}
}


exports.createAssetMap = function (options) {
	var assetMap = new AssetMap(options);
	allAssetMapsArr.push(assetMap);

	return assetMap;
};


exports.getAssetMaps = function (names) {
	var returnMap = {};

	if (names.length === 0) {
		for (var i = 0, len = allAssetMapsArr.length; i < len; i++) {
			returnMap[allAssetMapsArr[i].name] = allAssetMapsArr[i];
		}
	} else {
		for (var i = 0, len = names.length; i < len; i++) {
			for (var j = 0, jlen = allAssetMapsArr.length; j < jlen; j++) {
				if (names[i] === allAssetMapsArr[j].name) {
					returnMap[names[i]] = allAssetMapsArr[j];
				}
			}
		} 
	}

	return returnMap;
}


AssetMap.prototype.parseUri = function (uri) {
	var prefix = this.uriProtocol + '://';
	var prefixLength = prefix.length;

	// chop off the prefix

	if (uri.substring(0, prefixLength) === prefix) {
		uri = uri.substring(prefixLength).split('/');

		var context = uri.shift();
		var descriptor = uri.join('/');

		return {
			context: context,
			descriptor: descriptor
		};
	}

	return null;
};


AssetMap.prototype.getUrl = function (uri, language) {
	uri = this.parseUri(uri);
	if (!uri) {
		return null;
	}

	var filemap = this.assets[uri.context];
	if (!filemap) {
		return null;
	}

	var file = filemap[uri.descriptor];
	if (!file) {
		return null;
	}

	var baseUrl = this.baseUrl[uri.context];
	if (baseUrl === null) {
		mithril.core.logger.error('No baseUrl found for context "' + uri.context + '". Expected in config "module.assets.baseUrl.' + uri.context + '", or given in constructor options.');
		return null;
	}

	var len = file.length;
	for (var i = 0; i < len; i++) {
		var o = file[i];

		if (!o.language || language === o.language) {
			var url = baseUrl + mapPathRule(uri.descriptor, o.path);

			if (o.version && o.version !== 1) {
				url += '?v' + o.version;
			}

			return url;
		}
	}

	return null;
};


AssetMap.prototype.regFile = function (context, descriptor, path, version, language) {
	// path syntax may contain $n, where $0 will be replaced with descriptor, and $N will be replaced by descriptor chunk N (delimiter based):
	// eg:
	//      my/$2/path/file.png
	//      $0.png

	var o = { path: path };

	if (version && version !== 1) {
		o.version = version;
	}

	if (language) {
		o.language = language;
	}

	if (!this.assets[context]) {
		this.assets[context] = {};
	}

	if (descriptor in this.assets[context]) {
		this.assets[context][descriptor].push(o);
	} else {
		this.assets[context][descriptor] = [o];
	}
};


AssetMap.prototype.getTranslationMap = function (language) {
	var myFiles = {};

	for (var context in this.assets) {
		var baseUrl = mithril.core.config.get('module.assets.baseUrl.' + context);

		if (baseUrl === null) {
			mithril.core.logger.error('No baseUrl found in configuration for context "' + context + '". Expected in: module.assets.baseUrl.' + context);
		} else {
			myFiles[context] = { baseUrl: baseUrl, map: {} };

			var assets = this.assets[context];

			for (var identifier in assets) {
				var targets = assets[identifier];

				for (var i = 0, len = targets.length; i < len; i++) {
					var o = targets[i];

					if (!o.language || o.language === language) {
						var entry = o.path + '\t' + (o.version || '1');

						if (o.language) {
							entry += '\t' + o.language;
						}

						myFiles[context].map[identifier] = entry;
						break;
					}
				}
			}
		}
	}

	return {
		identDelimiter: '/',
		assets: myFiles
	};
};


AssetMap.prototype.applyTranslationMap = function (content, language) {
	var that = this;

	// TODO: the following regexp does not yet allow for alternative uri protocols

	return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
		return that.getUrl(uri, language) || '';
	});
};



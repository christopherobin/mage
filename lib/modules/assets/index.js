var mithril = require('../../mithril');


exports.assets = {};


exports.identDelimiter = '/';


function parseMuiUri(uri) {
	var m = /^mui:\/\/(.+?)\/(.+?)$/.exec(uri);
	if (m) {
		return { context: m[1], descriptor: m[2] };
	}

	return null;
}


function mapPathRule(descriptor, path) {
	var descParts = descriptor.split(exports.identDelimiter);

	return path.replace(/\$([0-9]+)/g, function (m) {
		return (m[1] === '0') ? descriptor : descParts[m[1] - 1];
	});
}


exports.getUrl = function (uri, language) {
	uri = parseMuiUri(uri);
	if (!uri) {
		return null;
	}

	var filemap = exports.assets[uri.context];
	if (!filemap) {
		return null;
	}

	var file = filemap[uri.descriptor];
	if (!file) {
		return null;
	}

	var baseUrl = mithril.getConfig('module.assets.baseUrl.' + uri.context);
	if (baseUrl === null) {
		mithril.core.logger.error('No baseUrl found in configuration for context "' + uri.context + '". Expected in: module.assets.baseUrl.' + uri.context);
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


exports.regFile = function (context, descriptor, path, version, language) {
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

	if (!exports.assets[context]) {
		exports.assets[context] = {};
	}

	if (descriptor in exports.assets[context]) {
		exports.assets[context][descriptor].push(o);
	} else {
		exports.assets[context][descriptor] = [o];
	}
};


exports.regImg   = exports.regFile.bind(this, 'img');
exports.regFont  = exports.regFile.bind(this, 'font');
exports.regAudio = exports.regFile.bind(this, 'audio');
exports.regVideo = exports.regFile.bind(this, 'video');


exports.getTranslationMap = function (language) {
	var myFiles = {};

	for (var context in exports.assets) {
		var baseUrl = mithril.getConfig('module.assets.baseUrl.' + context);

		if (baseUrl === null) {
			mithril.core.logger.error('No baseUrl found in configuration for context "' + context + '". Expected in: module.assets.baseUrl.' + context);
		} else {
			myFiles[context] = { baseUrl: baseUrl, map: {} };

			var assets = exports.assets[context];

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
		identDelimiter: exports.identDelimiter,
		assets: myFiles
	};
};


exports.applyTranslationMap = function (content, language) {
	return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
		return exports.getUrl(uri, language) || '';
	});
};


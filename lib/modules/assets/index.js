var mithril = require('../../mithril');


exports.files = {
	img: []
};


exports.descriptorDelimiter = '/';


function parseMuiUri(uri) {
	var m = /^mui:\/\/(.+?)\/(.+?)$/.exec(uri);
	if (m) {
		return { context: m[1], descriptor: m[2] };
	}

	return null;
}


function mapPathRule(descriptor, path) {
	var descParts = descriptor.split(exports.descriptorDelimiter);

	return path.replace(/\$([0-9]+)/g, function (m) {
		return (m[1] === '0') ? descriptor : descParts[m[1] - 1];
	});
}


exports.getUrl = function (uri, language) {
	uri = parseMuiUri(uri);
	if (!uri) {
		return null;
	}

	var filemap = exports.files[uri.context];
	if (!filemap) {
		return null;
	}

	var file = filemap[uri.descriptor];
	if (!file) {
		return null;
	}

	var baseUrl = mithril.getConfig('module.assets.baseUrl.' + uri.context);

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


function regFile(context, descriptor, path, version, language) {
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

	if (descriptor in exports.files[context]) {
		exports.files[context][descriptor].push(o);
	} else {
		exports.files[context][descriptor] = [o];
	}
}


exports.regImg = function (descriptor, path, version, language) {
	regFile('img', descriptor, path, version, language);
};


exports.regFont = function (descriptor, path, version, language) {
	regFile('font', descriptor, path, version, language);
};


exports.getTranslationMap = function (language) {
	var myFiles = {};

	for (var context in exports.files) {
		var baseUrl = mithril.getConfig('module.assets.baseUrl.' + context);

		myFiles[context] = { baseUrl: baseUrl, files: {} };

		var files = exports.files[context];

		for (var identifier in files) {
			var targets = files[identifier];

			for (var i = 0, len = targets.length; i < len; i++) {
				var o = targets[i];

				if (!o.language || o.language === language) {
					var path = o.path;

					if (o.version && o.version !== 1) {
						path += '?v' + o.version;
					}

					myFiles[context].files[identifier] = path;
					break;
				}
			}
		}
	}

	return {
		descriptorDelimiter: exports.descriptorDelimiter,
		files: myFiles
	};
};


exports.applyTranslationMap = function (content, language) {
	return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
		return exports.getUrl(uri, language);
	});
};


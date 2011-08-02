var mithril = require('../../mithril.js');


exports.files = {
	img: []
};


exports.descriptorDelimiter = '/';


function parseMuiUri(uri)
{
	var m = /^mui:\/\/(.+?)\/(.+?)$/.exec(uri);
	if (m)
	{
		return { context: m[1], descriptor: m[2] };
	}

	return null;
}


exports.getUrl = function(uri, language)
{
	uri = parseMuiUri(uri);
	if (!uri) return null;

	var filemap = exports.files[uri.context];
	if (!filemap) return null;

	var file = filemap[uri.descriptor];
	if (!file) return null;

	var descParts = uri.descriptor.split(exports.descriptorDelimiter);

	var len = file.length;
	for (var i=0; i < len; i++)
	{
		var o = file[i];

		if (!o.language || language === o.language)
		{
			var path = o.path.replace(/\$([0-9]+)/g, function(m) { return (m[1] == '0') ? uri.descriptor : descParts[m[1]-1]; });

			var url = mithril.core.config.module.assets.baseUrl[uri.context] + path;
			if (o.version && o.version != 1)
			{
				url += '?v' + o.version;
			}

			return url;
		}
	}

	return null;
}


exports.regImg = function(descriptor, path, version, language)
{
	regFile('img', descriptor, path, version, language);
};


function regFile(context, descriptor, path, version, language)
{
	// path syntax may contain $n, where $0 will be replaced with descriptor, and $N will be replaced by descriptor chunk N (delimiter based):
	// eg:
	// 		my/$2/path/file.png
	// 		$0.png

	var o = { path: path };

	if (version && version !== 1)
	{
		o.version = version;
	}

	if (language)
	{
		o.language = language;
	}

	if (descriptor in exports.files[context])
	{
		exports.files[context][descriptor].push(o);
	}
	else
	{
		exports.files[context][descriptor] = [o];
	}
};


exports.getTranslationMap = function(language)
{
	var myFiles = {};

	for (var context in exports.files)
	{
		myFiles[context] = { baseUrl: mithril.core.config.module.assets.baseUrl[context], files: {} };

		var files = exports.files[context];

		for (var identifier in files)
		{
			var targets = files[identifier];

			for (var i=0, len = targets.length; i < len; i++)
			{
				var o = targets[i];
				if (!o.language || o.language == language)
				{
					var path = o.path;

					if (o.version && o.version != 1)
					{
						path += '?v' + o.version;
					}

					myFiles[context].files[identifier] = path;
					break;
				}
			}
		}
	}

	return result = {
		descriptorDelimiter: exports.descriptorDelimiter,
		files: myFiles
	};
};


exports.applyTranslationMap = function(content, language)
{
	return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function(uri) { return exports.getUrl(uri, language); });
};


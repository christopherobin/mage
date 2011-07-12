var images = [];
var manifest = [];
var localCache = [];
var descriptorDelimiter = '/';


function getUrl(descriptor, language)
{
	var dParts = descriptor.split(descriptorDelimiter);
	var dPartsLen = dParts.length;

	var results = [];

	var len = images.length;
	for (var i=0; i < len; i++)
	{
		var img = images[i];

		if (img.language && img.language !== language) continue;

		var iParts = img.descriptor.split(descriptorDelimiter);

		var iPartsLen = iParts.length;

		if (dPartsLen !== iPartsLen) continue;

		var match = true;
		var variables = [];

		for (var j=0; j < dPartsLen; j++)
		{
			var dPart = dParts[j];
			var iPart = iParts[j];

			if (dPart !== iPart)
			{
				var m = /^\$\((.+)\)$/.exec(iPart);
				if (m)
				{
					variables.push([m[1], dPart]);
				}
				else
				{
					match = false;
					break;
				}
			}
		}

		if (!match) continue;

		results.push({ img: img, variables: variables });
	}

	if (results.length == 0) return null;

	results.sort(function(a,b) { return a.variables.length - b.variables.length; });

	var result = results[0];

	return translateImgUrl(result.img, result.variables)
}


function translateImgUrl(img, variables)
{
	var varMap = {};
	var len = variables.length;
	for (var i=0; i < len; i++)
	{
		varMap[variables[i][0]] = variables[i][1];
	}

	var error = false;

	var path = img.path.replace(/\$\(.+?\)/g, function(m) {
		var label = m.substring(2, m.length-1);

		if (label in varMap)
		{
			return varMap[label];
		}

		error = true;
		return '';
	});

	if (error) return null;

	var url = img.domain.baseUrl + path;
	if (img.version !== 1)
	{
		url += '?v' + img.version;
	}

	return url;
}


exports.add = function(domain, descriptor, path, version, language)
{
	version = version ? ~~version : 1;

	var o = { domain: domain, descriptor: descriptor, path: path, version: version };

	if (language)
	{
		o.language = language;
	}

	images.push(o);
};


exports.setCacheLevel = function(descriptor, level)
{
	localCache.push({ descriptor: descriptor, level: level });
};


exports.setManifest = function(descriptor)
{
	if (descriptor.indexOf('$') !== -1)
	{
		throw 'Variables not allowed in manifest descriptors.';
	}

	manifest.push(descriptor);
};


exports.getManifest = function(state, cb)
{
	var result = [];

	var len = manifest.length;
	for (var i=0; i < len; i++)
	{
		var descriptor = manifest[i];

		var url = getUrl(descriptor, state.language());

		if (!url) return state.error(null, 'Could not find url for image descriptor ' + descriptor + ' using language ' + state.language(), cb);

		result.push(url);
	}

	cb(null, result);
};


exports.getTranslationMap = function(state, cb)
{
	var result = { domains: [], images: [] };

	var len = images.length;
	for (var i=0; i < len; i++)
	{
		var img = images[i];

		if (img.language && img.language !== state.language()) continue;

		var domainIndex = result.domains.indexOf(img.domain);
		if (domainIndex === -1)
		{
			domainIndex = result.domains.push(img.domain)-1;
		}

		result.images.push([domainIndex, img.descriptor, img.path, img.version]);
	}

	result.domains = result.domains.map(function(domain) { return domain.baseUrl; });

	cb(null, result);
};


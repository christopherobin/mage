var images = {};
var domains = [];

exports.descriptorDelimiter = '/';


exports.getUrl = function(descriptor, language)
{
	var img = images[descriptor];

	if (!img) return null;

	var descParts = descriptor.split(exports.descriptorDelimiter);

	var len = img.length;
	for (var i=0; i < len; i++)
	{
		var o = img[i];

		if (!o.language || language === o.language)
		{
			var path = o.path.replace(/\$([0-9]+)/g, function(m) { return (m[1] == '0') ? descriptor : descParts[m[1]-1]; });

			var url = domains[o.domain] + path;
			if (o.version)
			{
				url += '?v' + o.version;
			}

			return url;
		}
	}

	return null;
}


exports.add = function(descriptor, domain, path, version, language)
{
	// path syntax may contain $n, where $0 will be replaced with descriptor, and $N will be replaced by descriptor chunk N (delimiter based):
	// eg:
	// 		my/$2/path/file.png
	// 		$0.png

	var domainIndex = domains.indexOf(domain);
	if (domainIndex === -1)
	{
		domainIndex = domains.push(domain)-1;
	}

	var o = { domain: domainIndex, path: path };

	if (version && version !== 1)
	{
		o.version = version;
	}

	if (language)
	{
		o.language = language;
	}

	if (descriptor in images)
	{
		images[descriptor].push(o);
	}
	else
	{
		images[descriptor] = [o];
	}
};


exports.getTranslationMap = function(language)
{
	var myImages = {};
	for (var identifier in images)
	{
		var targets = images[identifier];

		for (var i=0, len = targets.length; i < len; i++)
		{
			var o = targets[i];
			if (!o.language || o.language == language)
			{
				var data = [o.domain, o.path];
				if (o.version) data.push(o.version);

				myImages[identifier] = data;
				break;
			}
		}
	}

	return result = {
		domains: domains,
		descriptorDelimiter: exports.descriptorDelimiter,
		images: myImages
	};
};


exports.applyTranslationMap = function(content, language)
{
	return content.replace(/mui:\/\/img\/([\/\w\-]+)/g, function(match) {
		var identifier = match.substring(10);

		return exports.getUrl(identifier, language);
	});
};


/*
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
*/


/*
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
*/


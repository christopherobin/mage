function MuiPackage(name)
{
	this.name = name;
	this.manifest = new Manifest;
	this.pages = [];
};


MuiPackage.prototype.addPage = function(page)
{
	this.pages.push(page);
};


MuiPackage.prototype.getPage = function(name)
{
	var len = this.pages.length;

	for (var i=0; i < len; i++)
	{
		var page = this.pages[i];
		if (page && page.name === name) return page;
	}

	return null;
};


module.exports = MuiPackage;


function Manifest()
{
	this.uris = [];
	this.cache = {};
}


Manifest.prototype.add = function(uri)
{
	this.uris.push(uri);
	this.cache = {};
};


Manifest.prototype.get = function(language)
{
	var cached = this.cache[language];
	if (cached)
	{
		return cached;
	}

	var files = [];

	// images:

	for (var i=0, len = this.uris.length; i < len; i++)
	{
		var url = mithril.assets.getUrl(this.uris[i], language);

		if (url)
		{
			files.push(url);
		}
		else
		{
			mithril.core.logger.error('No URL found for asset: ' + this.uris[i] + ' (' + language + ')');
		}
	}

	files.sort();

	var output = ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');

	if (!this.cache[language])
	{
		this.cache[language] = output;
	}

	return output;
};


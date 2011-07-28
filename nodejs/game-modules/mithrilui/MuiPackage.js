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
	this.images = [];
	this.cache = {};
}


Manifest.prototype.img = function(identifier)
{
	this.images.push(identifier);
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

	for (var i=0, len = this.images.length; i < len; i++)
	{
		files.push(mithril.mithrilui.img.getUrl(this.images[i], language));
	}

	files.sort();

	var output = ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');

	if (!this.cache[language])
	{
		this.cache[language] = output;
	}

	return output;
};


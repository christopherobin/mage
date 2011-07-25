var pagePackages = require(__dirname + '/pagePackages.js');


function Page(name)
{
	this.name = name;
	this.manifest = [];
	this.packages = [];
};


Page.prototype.addToManifest = function(descriptor)
{
	this.manifest.push(descriptor);
};


Page.prototype.getManifest = function(img, language)
{
	var files = [];
	var len = this.manifest.length;

	for (var i=0; i < len; i++)
	{
		files.push(img.getUrl(this.manifest[i], language));
	}

	files.sort();

	return ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');
};


Page.prototype.addPackage = function(pckg)
{
	this.packages.push(pckg);
};


Page.prototype.getPackage = function(name)
{
	var len = this.packages.length;

	for (var i=0; i < len; i++)
	{
		var pckg = this.packages[i];
		if (pckg && pckg.name === name) return pckg;
	}

	return null;
};

exports.Page = Page;


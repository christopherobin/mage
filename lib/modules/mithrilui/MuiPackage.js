var mithril = require('../../mithril'),
	Manifest = require('./manifest').Manifest;


function MuiPackage(name) {
	this.name = name;
	this.manifest = new Manifest();
	this.pages = [];
}


MuiPackage.prototype.addPage = function (page) {
	page.registerPackage(this.name);
	this.pages.push(page);
};


MuiPackage.prototype.getPage = function (name) {
	var len = this.pages.length;

	for (var i = 0; i < len; i++) {
		var page = this.pages[i];

		if (page && page.name === name) {
			return page;
		}
	}

	return null;
};


exports.MuiPackage = MuiPackage;


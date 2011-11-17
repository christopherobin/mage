var mithril = require('../../mithril'),
	Manifest = require('./manifest').Manifest;


function MuiPackage(name) {
	this.name = name;
	this.manifest = new Manifest();
	this.pages = [];
	this.builders = {};
}


MuiPackage.prototype.addPage = function (page) {
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


MuiPackage.prototype.addBuilder = function (name, fn) {
	this.builders[name] = fn;
};


exports.MuiPackage = MuiPackage;


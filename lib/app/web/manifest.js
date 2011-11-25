var mithril = require('../../mithril');


function Manifest(assetMap) {
	this.assetMap = assetMap;
	this.uris = [];
}


exports.Manifest = Manifest;


Manifest.prototype.add = function (uri) {
	this.uris.push(uri);
};


Manifest.prototype.generate = function (language) {
	var files = [];

	// images:

	for (var i = 0, len = this.uris.length; i < len; i++) {
		var url = this.assetMap.getUrl(this.uris[i], language);

		if (url) {
			files.push(url);
		} else {
			mithril.core.logger.error('No URL found for asset: ' + this.uris[i] + ' (' + language + ')');
		}
	}

	files.sort();

	return ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');
};


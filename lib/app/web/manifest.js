var mithril = require('../../mithril');


function Manifest(assetMap) {
	this.assetMap = assetMap;
	this.assets = [];
}


exports.Manifest = Manifest;


Manifest.prototype.add = function (context, descriptor) {
	this.assets.push([context, descriptor]);
};


Manifest.prototype.generate = function (clientConfig) {
	var files = [],
		numAssets = this.assets.length >>> 0,
		assetMap = this.assetMap.getAssetsForConfig(clientConfig);

	while (numAssets > 0) {
		var tuple = this.assets[--numAssets],
			context = tuple[0],
			descriptor = tuple[1],
			contextMap = assetMap.assets[context],
			asset = contextMap && contextMap.map[descriptor],
			url = asset && encodeURI(contextMap.baseUrl + asset[0]) + '?v' + asset[1];

		if (url) {
			files.push(url);
		} else {
			mithril.core.logger.error('No URL found for asset: ' + tuple.join('/') + ' (' + JSON.stringify(clientConfig) + ')');
		}
	}

	files.sort();

	return ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');
};


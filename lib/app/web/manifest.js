var mage = require('../../mage');
var logger = mage.core.logger;

function Manifest(assetMap) {
	this.assetMap = assetMap;
}

exports.Manifest = Manifest;

Manifest.prototype.generate = function (clientConfig) {
	var files = [];
	var assetMap = this.assetMap.getAssetsForConfig(clientConfig);

	for (var context in assetMap.assets) {
		var contextMap = assetMap.assets[context];
		for (var descriptor in contextMap.map) {
			var asset = contextMap.map[descriptor];

			var url = asset && encodeURI(contextMap.baseUrl + asset[0]) + '?' + asset[1];

			if (url) {
				if (asset[2] === 0) {
					files.push(url);
				}
			} else {
				logger.error('No URL found for asset: ' + context + ' (' + JSON.stringify(clientConfig) + ')');
			}
		}
	}

	files.sort();

	return ['CACHE MANIFEST', '', 'CACHE:'].concat(files).concat('', 'NETWORK:', '*').join('\n');
};


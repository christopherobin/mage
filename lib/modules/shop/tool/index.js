// index file to setup pages

exports.setup = function (tool, options, cb) {
	var pagePath = __dirname + '/page';
	var assets   = {};
	if (options.assetMap) {
		assets = options.assetMap;
	}

	tool.addPage('shop', pagePath, assets);
	cb(null, ['shop']);
};


// index file to setup pages

exports.setup = function (tool, options, cb) {
	var pagePath = __dirname + '/page';
	var assets   = {};
	if (options.assetMap) {
		assets = options.assetMap;
	}

	tool.addPage('gc', pagePath, assets);
	cb(null, ['gc']);
};


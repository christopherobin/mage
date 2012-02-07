
exports.setup = function (tool, options, cb) {
	var pagePath = __dirname + '/page';
	var assets   = {};
	if (options.assetMap) {
		assets = options.assetMap;
	}

	tool.addPage('giraffe', pagePath, assets);
	cb(null, ['giraffe']);
};

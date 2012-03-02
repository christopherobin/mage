
exports.setup = function (tool, options, cb) {
	var pagePath = __dirname + '/page';

	tool.addPage('giraffe', pagePath);
	cb();
};

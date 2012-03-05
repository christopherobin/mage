// index file to setup pages

exports.setup = function (tool, options, cb) {
	var pagePath = __dirname + '/page';

	tool.addPage('gc', pagePath);
	cb(null);
};


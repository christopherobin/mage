exports.setup = function (tool, options, cb) {
	tool.addPage('schedulerServer', __dirname + '/page');
	cb();
};

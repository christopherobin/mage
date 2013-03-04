exports.setup = function (tool, options, cb) {
	tool.addPage('schedulerServer', './page');
	cb();
};

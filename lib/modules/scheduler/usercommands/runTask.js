"use strict";

var scheduler = require('../../scheduler');

exports.params = ['appName', 'taskName', 'data'];
exports.execute = function (state, appName, taskName, data, cb) {
	scheduler.runNow(appName, taskName, data);
	return cb();
};

var mage = require('../../../mage');

exports.params = ['client', 'taskName', 'schedule', 'data'];

exports.execute = function (state, client, taskName, schedule, data, cb) {
	mage.schedulerServer.scheduleCommand(state, client, taskName, schedule, data, cb);
};
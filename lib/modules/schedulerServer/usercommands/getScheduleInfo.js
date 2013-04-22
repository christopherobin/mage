var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['scheduleKey'];

exports.execute = function (state, scheduleKey, cb) {
	mage.schedulerServer.getScheduleInfo(state, scheduleKey, cb);
};
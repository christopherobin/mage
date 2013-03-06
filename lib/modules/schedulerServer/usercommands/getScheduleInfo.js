var mage = require('../../../mage');

exports.params = ['scheduleKey'];

exports.execute = function (state, scheduleKey, cb) {
	mage.schedulerServer.getScheduleInfo(state, scheduleKey, cb);
};
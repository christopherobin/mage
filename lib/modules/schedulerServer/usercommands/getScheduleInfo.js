var mage = require('../../../mage');

exports.params = ['scheduleKey'];
exports.execute = mage.schedulerServer.getScheduleInfo;
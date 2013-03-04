var mage = require('../../../mage');

exports.params = ['client', 'taskName', 'schedule', 'data'];
exports.execute = mage.schedulerServer.scheduleCommand;
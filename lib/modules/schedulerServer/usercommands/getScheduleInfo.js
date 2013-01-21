var mithril = require(__dirname + '/../../../mithril');

exports.params = ['scheduleKey'];
exports.execute = mithril.schedulerServer.getScheduleInfo;
var mithril = require(__dirname + '/../../../mithril');

exports.params = ['client', 'taskName', 'schedule', 'data'];
exports.execute = mithril.schedulerServer.scheduleCommand;
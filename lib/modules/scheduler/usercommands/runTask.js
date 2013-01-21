var mithril = require('../../../mithril');

exports.params = ['appName', 'taskName', 'data'];
exports.execute = function (state, appName, taskName, data, cb) {
	// Return imediately to the caller, as this is a fire and forget operation
	// and we don't want to wait for runNow() to complete.
	cb();

	// The caller doesn't care about a failure here. Client tasks should handle
	// rollbacks using their own state, so we're not passing 'state' nor 'cb'
	// here.
	mithril.scheduler.runNow(appName, taskName, data);
};

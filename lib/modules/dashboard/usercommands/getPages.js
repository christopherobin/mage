var mage = require('../../../mage');


exports.acl = ['admin'];

exports.params = ['appName'];


exports.execute = function (state, appName, cb) {
	state.respond(mage.dashboard.getPages(appName));
	cb();
};

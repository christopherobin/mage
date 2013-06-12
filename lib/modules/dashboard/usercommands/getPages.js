var mage = require('../../../mage');


exports.access = 'admin';

exports.params = ['appName'];


exports.execute = function (state, appName, cb) {
	state.respond(mage.dashboard.getPages(appName));
	cb();
};

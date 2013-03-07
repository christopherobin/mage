var mage = require('../../../mage');

exports.params = [];

exports.execute = function (state, cb) {
	mage.schedulerServer.shutdown(state, cb);
};
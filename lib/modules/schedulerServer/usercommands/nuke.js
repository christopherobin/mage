var mage = require('../../../mage');

exports.access = 'admin';

exports.params = [];

exports.execute = function (state, cb) {
	mage.schedulerServer.nuke(state, cb);
};
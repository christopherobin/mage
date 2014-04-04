var mage = require('../../../mage');


exports.access = 'admin';

exports.params = [];


exports.execute = function (state, cb) {
	state.respond(mage.core.archivist.getTopics());

	cb();
};

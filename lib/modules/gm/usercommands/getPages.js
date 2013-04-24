var mage = require('../../../mage');


exports.access = 'admin';

exports.params = [];


exports.execute = function (state, cb) {
	state.respond(mage.gm.getPages());
	cb();
};

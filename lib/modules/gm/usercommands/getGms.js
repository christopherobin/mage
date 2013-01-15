var mage = require('../../../mage');

exports.params = [];

exports.execute = function (state, cb) {
	mage.gm.getGms(state, function (errors, gms) {
		if (errors) {
			return cb(errors);
		}

		state.respond(gms);
		cb();
	});
};

var mithril = require('../../../mithril');

exports.params = [];

exports.execute = function (state, cb) {
	mithril.gm.getGms(state, function (errors, gms) {
		if (errors) {
			return cb(errors);
		}

		state.respond(gms);
		cb();
	});
};

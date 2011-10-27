var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	mithril.gm.getGms(state, function (errors, gms) {
		if (errors) {
			return cb(errors);
		}

		state.respond(gms);
		cb();
	});
};

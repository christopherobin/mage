var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	mithril.persistent.getAll(state, function (error, data) {
		if (!error) {
			state.respond(data);
		}

		cb();
	});
};


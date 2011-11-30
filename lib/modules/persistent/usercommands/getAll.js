var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	mithril.persistent.getAll(state, function (error, data) {
		if (!error) {
			state.respond(data);
		}

		cb();
	});
};


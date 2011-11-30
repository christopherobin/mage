var mithril = require('../../../mithril');


exports.params = ['properties', 'removeAfterGet'];


exports.execute = function (state, properties, removeAfterGet, cb) {
	mithril.persistent.get(state, properties, removeAfterGet, function (error, data) {
		if (!error) {
			state.respond(data);
		}

		cb();
	});
};


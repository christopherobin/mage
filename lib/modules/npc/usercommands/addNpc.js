var mithril = require('../../../mithril');

exports.params = ['identifier', 'data'];

exports.execute = function (state, identifier, data, cb) {
	mithril.npc.addNpc(state, identifier, data, function (err, id) {
		if (err) {
			return cb(err);
		}
		if (id) {
			state.respond(id);
		}
		cb();
	});
};
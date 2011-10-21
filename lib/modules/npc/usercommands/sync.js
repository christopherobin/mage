var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	var npcs = mithril.npc.getAll();

	state.respond(npcs);

	cb();
};


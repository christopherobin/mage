var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, p, cb) {
	var result = [];

	var npcs = mithril.npc.getAll();

	for (var i = 0, len = npcs.length; i < len; i++) {
		var npc = npcs[i];

		result.push({
			actor: npc.actor,
			identifier: npc.identifier,
			data: npc.data.getAll(state.language())
		});
	}

	state.respond(result);

	cb();
};


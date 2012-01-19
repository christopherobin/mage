var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	var json = mithril.npc.getSyncData(state.language());

	state.respondJson(json);

	cb();
};


var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	var json = mage.npc.getSyncData(state.language());

	state.respondJson(json);

	cb();
};


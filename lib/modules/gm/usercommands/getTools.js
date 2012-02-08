var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	var toolpages = mithril.gm.getRegisteredTools();

	state.respond(toolpages);
	cb();
};


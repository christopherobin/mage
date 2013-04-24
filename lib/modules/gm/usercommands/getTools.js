var mage = require('../../../mage');


exports.access = 'admin';

exports.params = [];


exports.execute = function (state, cb) {
	var toolpages = mage.gm.getRegisteredTools();

	state.respond(toolpages);
	cb();
};


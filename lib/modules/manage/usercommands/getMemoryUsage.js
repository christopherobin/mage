var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	state.respond(process.memoryUsage());
	cb();
};


var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	state.respond(process.memoryUsage());
	cb();
};


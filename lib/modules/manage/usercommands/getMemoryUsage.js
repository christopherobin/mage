var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	state.respond(process.memoryUsage());
	cb();
};


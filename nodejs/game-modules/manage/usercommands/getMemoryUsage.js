var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	state.respond(process.memoryUsage());
	cb();
};


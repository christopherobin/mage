exports.execute = function(state, p, cb)
{
	state.respond(process.memoryUsage());
	cb();
};


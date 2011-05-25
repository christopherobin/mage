exports.execute = function(state, p, cb)
{
	var options = p.options || {};

	if (options.loadProgressForActor)
	{
		options.loadProgressForActor = state.actorId;
	}

	mithril.gc.loadNodes(state, options, function(error, nodes) {
		if (!error)
			state.respond(nodes);

		cb();
	});
};


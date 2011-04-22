exports.execute = function(state, playerId, p, cb)
{
	var options = p.options || {};

	if (options.loadProgressForActor)
	{
		options.loadProgressForActor = playerId;
	}

	mithril.gc.loadNodes(state, options, function(error, nodes) {
		if (error)
			state.msgClient.error(1234);
		else
			state.msgClient.respond(nodes);
		cb();
	});
};


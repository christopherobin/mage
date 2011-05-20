exports.execute = function(state, p, cb)
{
	var result = {};

	// requests I made

	mithril.sns.requestRelation(state, p.type, state.actorId, p.actorId, function(error, id) {
		if (error) { state.error(1234); cb(); return; }

		state.respond(id);
		cb();
	});
};


exports.execute = function(state, p, cb)
{
	mithril.sns.requestRelation(state, p.type, state.actorId, p.actorId, function(error, id) {
		if (!error)
			state.respond({ id: id });

		cb();
	});
};


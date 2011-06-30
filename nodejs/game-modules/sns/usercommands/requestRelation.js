exports.execute = function(state, p, cb)
{
	mithril.sns.requestRelation(state, p.type, state.actorId, p.actorId, function(error, info) {
		if (!error)
			state.respond({ info: info });

		cb();
	});
};


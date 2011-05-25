exports.execute = function(state, p, cb)
{
	var result = {};

	// requests I made

	mithril.sns.getRelationRequests(state, null, state.actorId, null, function(error, requests) {
		if (error) return cb();

		result.outbox = requests.map(function(request) { return { id: request.id, type: request.type, toActor: request.targetActor, creationTime: request.creationTime }; });

		// requests made to me

		mithril.sns.getRelationRequests(state, null, null, state.actorId, function(error, requests) {
			if (error) return cb();

			result.inbox = requests.map(function(request) { return { id: request.id, type: request.type, fromActor: request.actor, creationTime: request.creationTime }; });


			// existing relations

			mithril.sns.getRelations(state, null, state.actorId, function(error, relations) {
				if (error) return cb();

				result.relations = relations;

				state.respond(result);

				cb();
			});
		});
	});
};


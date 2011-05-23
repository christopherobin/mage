exports.execute = function(state, p, cb)
{
	var result = {};

	// requests I made

	mithril.sns.getRelationRequests(state, null, state.actorId, null, function(error, requests) {
		if (error) { state.error(1234); cb(); return; }

		result.outbox = requests.map(function(request) { return { id: request.id, type: request.type, toActor: request.targetActor, creationTime: request.creationTime }; });

		// requests made to me

		mithril.sns.getRelationRequests(state, null, null, state.actorId, function(error, requests) {
			if (error) { state.error(1235); cb(); return; }

			result.inbox = requests.map(function(request) { return { id: request.id, type: request.type, fromActor: request.actor, creationTime: request.creationTime }; });


			// existing relations

			mithril.sns.getRelations(state, null, state.actorId, function(error, relations) {
				if (error) { state.error(1236); cb(); return; }

				result.relations = relations;

				state.respond(result);

				cb();
			});
		});
	});
};


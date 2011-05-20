exports.execute = function(state, p, cb)
{
	var result = {};

	// requests I made

	mithril.sns.getRelationRequests(state, null, state.actorId, null, function(error, requests) {
		if (error) { state.error(1234); cb(); return; }

		result.outbox = requests;

		// requests made to me

		mithril.sns.getRelationRequests(state, null, null, state.actorId, function(error, requests) {
			if (error) { state.error(1235); cb(); return; }

			result.inbox = requests;


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


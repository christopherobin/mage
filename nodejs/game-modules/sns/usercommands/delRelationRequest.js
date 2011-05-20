exports.execute = function(state, p, cb)
{
	var result = {};

	// requests I made

	mithril.sns.delRelationRequest(state, p.requestId, function(error) {
		if (error) { state.error(1234); cb(); return; }

		cb();
	});
};


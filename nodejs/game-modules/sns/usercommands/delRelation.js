exports.execute = function(state, p, cb)
{
	mithril.sns.delRelation(state, p.relationId, function(error) {
		if (error) { state.error(1234); cb(); return; }

		cb();
	});
};


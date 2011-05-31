exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(err,list) {
		if (err) return cb();
		mithril.score.getRankingData(state, list.id, {from:1, to:100}, function(error,data) {
			if (error) return cb();
			list.data = data;

			state.respond({ ranking: list });
			cb();
		})
	});
}
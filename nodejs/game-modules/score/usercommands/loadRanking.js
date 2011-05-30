exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(err,list) {
		mithril.score.getRankingData(state, list.id, {from:1, to:100}, function(error,data) {
			
			list.data = data;

			state.respond({ ranking: list });
			cb();
		})
	});
}
exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(err,list) {
		mithril.score.getRankingDataByActor(state, list.id, function(error,data) {
			mithril.score.getRankingData(state, list.id, {from:data.rank-2, to:data.rank +2}, function(error,records) {
				
				list.data = records;
			
				state.respond({ ranking: list });
				cb();
			
			});
		});
	});
}
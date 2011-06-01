exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(err,list) {
		if (err) { return cb(); }
		if (list == null) { state.respond({ ranking: null }); return cb(); }
		mithril.score.getRankingDataByActor(state, list.id, function(error,data) {
			if (error) return cb();
			mithril.score.getRankingData(state, list.id, {from:data.rank-2, to:data.rank +2}, function(errs,records) {
				if (errs) return cb();
				list.data = records;
				state.respond({ ranking: list });
				cb();
			});
		});
	});
}
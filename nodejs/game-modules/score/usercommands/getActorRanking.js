exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(error, list) {
		if (error) { return cb(); }

		if (!list) { return cb(); }

		mithril.score.getRankingDataByActor(state, list.id, function(error, data) {
			if (error) { return cb(); }

			if (!data) { return cb(); }

			mithril.score.getRankingData(state, list.id, { from: data.rank - 2, to: data.rank + 2 }, function(error, records) {
				if (error) { return cb(); }

				list.data = records;
				state.respond(list);

				cb();
			});
		});
	});
}

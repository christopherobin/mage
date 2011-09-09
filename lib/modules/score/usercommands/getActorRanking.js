var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function (error, list) {
		if (error) {
			return cb();
		}

		if (!list) {
			return cb();
		}

		mithril.score.getRankingDataByActor(state, p.actorId, list.id, function (error, data) {
			if (error) {
				return cb();
			}

			if (!data) {
				return cb();
			}

			if (!p.range) {
				list.data = [data];
				state.respond(list);
				return cb();
			}

			mithril.score.getRankingData(state, list.id, { from: data.rank - p.range, to: data.rank + p.range }, function (error, records) {
				if (error) {
					return cb();
				}

				list.data = records;
				state.respond(list);

				cb();
			});
		});
	});
};


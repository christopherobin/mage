var mithril = require('../../../mithril');


exports.params = ['context', 'name', 'actorId', 'range'];


exports.execute = function (state, context, name, actorId, range, cb) {
	mithril.score.getLatestRankingListByContext(state, context, name, function (error, list) {
		if (error) {
			return cb();
		}

		if (!list) {
			return cb();
		}

		mithril.score.getRankingDataByActor(state, actorId, list.id, function (error, data) {
			if (error) {
				return cb();
			}

			if (!data) {
				return cb();
			}

			if (!range) {
				list.data = [data];
				state.respond(list);
				return cb();
			}

			mithril.score.getRankingData(state, list.id, { from: data.rank - range, to: data.rank + range }, function (error, records) {
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


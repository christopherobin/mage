var mithril = require('../../../mithril');


exports.params = ['context', 'name'];


exports.execute = function (state, context, name, cb) {
	mithril.score.getLatestRankingListByContext(state, context, name, function (error, list) {
		if (error) {
			return cb();
		}

		if (!list) {
			state.respond({ ranking: null });
			return cb();
		}

		//TODO: from and to should be dynamic

		mithril.score.getRankingData(state, list.id, { from: 1, to: 100 }, function (error, data) {
			if (error) {
				return cb();
			}

			list.data = data;

			state.respond({ ranking: list });
			cb();
		});
	});
};


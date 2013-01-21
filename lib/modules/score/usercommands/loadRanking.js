var mage = require('../../../mage');


exports.params = ['context', 'name'];


exports.execute = function (state, context, name, cb) {
	mage.score.getLatestRankingListByContext(state, context, name, function (error, list) {
		if (error) {
			return cb();
		}

		if (!list) {
			return cb();
		}

		//TODO: from and to should be dynamic

		mage.score.getRankingData(state, list.id, { from: 1, to: 100 }, function (error, data) {
			if (error) {
				return cb();
			}

			list.data = data;

			state.respond(list);
			cb();
		});
	});
};


var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	mithril.score.getLatestRankingListByContext(state, p.context, p.name, function(err,list) {
		if (err) return cb();
		//TODO: from and to should be dynamic
		mithril.score.getRankingData(state, list.id, {from:1, to:100}, function(error,data) {
			if (error) return cb();
			list.data = data;

			state.respond({ ranking: list });
			cb();
		})
	});
}

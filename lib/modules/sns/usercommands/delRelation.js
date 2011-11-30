var mithril = require('../../../mithril');


exports.params = ['relationId'];


exports.execute = function (state, relationId, cb) {
	mithril.sns.delRelation(state, relationId, function (error) {
		cb();
	});
};


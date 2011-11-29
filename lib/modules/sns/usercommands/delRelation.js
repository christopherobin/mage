var mithril = require('../../../mithril');


exports.params = ['relationId'];


exports.execute = function (state, p, cb) {
	mithril.sns.delRelation(state, p.relationId, function (error) {
		cb();
	});
};


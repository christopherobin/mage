var mithril = require('../../../mithril');

exports.execute = function(state, p, cb)
{
	mithril.sns.delRelation(state, p.relationId, function(error) {
		cb();
	});
};

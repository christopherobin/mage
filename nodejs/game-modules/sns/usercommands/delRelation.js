var mithril = require('../../../mithril.js');

exports.execute = function(state, p, cb)
{
	mithril.sns.delRelation(state, p.relationId, function(error) {
		cb();
	});
};


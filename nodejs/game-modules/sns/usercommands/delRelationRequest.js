var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	mithril.sns.delRelationRequest(state, p.requestId, function(error) {
		cb();
	});
};


var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	mithril.sns.requestRelation(state, p.type, state.actorId, p.actorId, cb);
};


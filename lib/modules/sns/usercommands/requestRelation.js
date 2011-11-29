var mithril = require('../../../mithril');


exports.params = ['type', 'actorId'];


exports.execute = function (state, p, cb) {
	mithril.sns.requestRelation(state, p.type, state.actorId, p.actorId, cb);
};


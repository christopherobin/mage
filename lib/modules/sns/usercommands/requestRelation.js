var mithril = require('../../../mithril');


exports.params = ['type', 'actorId'];


exports.execute = function (state, type, actorId, cb) {
	mithril.sns.requestRelation(state, type, state.actorId, actorId, cb);
};


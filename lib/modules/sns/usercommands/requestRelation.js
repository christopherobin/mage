var mage = require('../../../mage');


exports.params = ['type', 'actorId'];


exports.execute = function (state, type, actorId, cb) {
	mage.sns.requestRelation(state, type, state.actorId, actorId, cb);
};


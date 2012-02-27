var mithril = require('../../../mithril');

exports.params = ['id'];

exports.execute = function (state, id, cb) {
	mithril.npc.delNpc(state, id, cb);
};
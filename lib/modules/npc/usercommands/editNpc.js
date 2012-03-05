var mithril = require('../../../mithril');

exports.params = ['id', 'ident', 'data'];

exports.execute = function (state, id, ident, data, cb) {
	mithril.npc.editNpc(state, id, ident, data, cb);
};
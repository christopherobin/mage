var mithril = require('../../../mithril');

exports.params = ['identifier', 'properties'];

exports.execute = function (state, identifier, properties, cb) {
	mithril.npc.replaceNpc(state, identifier, properties, cb);
};

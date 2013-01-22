var mage = require('../../../mage');

exports.params = ['identifier', 'properties'];

exports.execute = function (state, identifier, properties, cb) {
	mage.npc.replaceNpc(state, identifier, properties, cb);
};

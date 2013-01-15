var mage = require('../../../mage');

exports.params = ['id'];

exports.execute = function (state, id, cb) {
	mage.npc.delNpc(state, id, cb);
};
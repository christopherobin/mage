var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['id'];

exports.execute = function (state, id, cb) {

	mage.gm.delGm(state, id, cb);
};

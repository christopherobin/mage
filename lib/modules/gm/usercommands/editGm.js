var mage = require('../../../mage');

exports.params = ['actor', 'password', 'rights'];

exports.execute = function (state, actor, password, rights, cb) {
	mage.gm.editGm(state, actor, password, rights, cb);
};

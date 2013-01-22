var mage = require('../../../mage');
var crypto  = require('crypto');
var config = mage.core.config.get('tool');

exports.params = ['actor', 'password', 'rights'];

exports.execute = function (state, actor, password, rights, cb) {
	mage.gm.editGm(state, actor, password, rights, cb);
};

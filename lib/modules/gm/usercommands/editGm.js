var mithril = require('../../../mithril');
var crypto  = require('crypto');
var config = mithril.core.config.get('tool');

exports.params = ['actor', 'password', 'rights'];

exports.execute = function (state, actor, password, rights, cb) {
	mithril.gm.editGm(state, actor, password, rights, cb);
};

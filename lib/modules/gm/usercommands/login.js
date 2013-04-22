var mage = require('../../../mage');


exports.access = 'anonymous';

exports.params = ['username', 'password'];


exports.execute = function (state, username, password, cb) {
	mage.gm.login(state, username, password, cb);
};

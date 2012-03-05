var mithril = require('../../../mithril');


exports.params = ['username', 'password'];


exports.execute = function (state, username, password, cb) {
	mithril.gm.login(state, username, password, cb);
};


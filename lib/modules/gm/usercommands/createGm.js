var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['username', 'password', 'rights'];

exports.execute = function (state, username, password, rights, cb) {
	mage.gm.addGm(state, username, password, rights, function (error, gm) {
		if (!error) {
			state.respond(gm);
		}

		cb();
	});
};


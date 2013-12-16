var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engineName', 'credentials', 'control'];

exports.execute = function (state, engineName, credentials, control, cb) {
	// attempt to login

	mage.ident.check(state, engineName, credentials, control, function (error, user) {
		if (error) {
			return cb(error);
		}

		state.respond(user);
		cb();
	});
};

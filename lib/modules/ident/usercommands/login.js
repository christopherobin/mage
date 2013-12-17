var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engineName', 'credentials', 'options'];

exports.execute = function (state, engineName, credentials, options, cb) {
	// attempt to login

	mage.ident.login(state, engineName, credentials, options, function (error, user) {
		if (error) {
			return cb(error);
		}

		state.respond(user);
		cb();
	});
};

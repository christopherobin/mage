var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engineName', 'credentials', 'control'];

exports.execute = function (state, engineName, credentials, control, cb) {
	// attempt to login

	mage.ident.check(state, engineName, credentials, control, function (error, session) {
		if (error) {
			return cb(error);
		}

		state.respond(session.actorId);
		cb();
	});
};

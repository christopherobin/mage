var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engineName', 'credentials', 'options'];

exports.execute = function (state, engineName, credentials, options, cb) {
	// attempt to login

	mage.ident.login(state, engineName, credentials, options, function (error, session) {
		if (error) {
			return state.error('ident', error, cb);
		}

		state.respond({
			key: session.getFullKey(),
			actorId: session.actorId,
			meta: session.meta
		});

		cb();
	});
};

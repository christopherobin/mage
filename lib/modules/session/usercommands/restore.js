var mage = require('../../../mage');
var logger = mage.logger;

exports.access = 'anonymous';

exports.params = ['sessionKey'];

exports.execute = function (state, sessionKey, cb) {
	sessionKey = sessionKey || '';

	mage.session.resolve(state, sessionKey, function (err, session) {
		if (err) {
			logger.error
				.data(err)
				.log('Tried to validate a session but could not resolve');

			return state.error(err, err, cb);
		}

		logger.debug
			.data('key', sessionKey)
			.data('session', session || 'none')
			.log('Validating key');

		state.registerSession(session);

		session.setOnClient(state);

		cb();
	});
};

var mage = require('../../../mage');
var logger = mage.logger;

exports.access = 'anonymous';

exports.params = ['engine', 'sessionKey'];

exports.execute = function (state, engineName, sessionKey, cb) {
	sessionKey = sessionKey || '';

	mage.session.resolve(state, sessionKey, function (err, session) {
		if (err) {
			logger.error
				.data(err)
				.log('Tried to validate a session but could not resolve');

			return cb(err);
		}

		logger.debug
			.data('key', sessionKey)
			.data('session', session || 'none')
			.log('Validating key');

		var engine;
		try {
			engine = mage.ident.getEngine(engineName);
		} catch (e) {
			return state.error('ident', e, cb);
		}

		engine.getUser(state, session.actorId, function (error, user) {
			if (error) {
				return state.error('ident', error, cb);
			}

			state.respond({ user: user });
			return cb();
		});
	});
};

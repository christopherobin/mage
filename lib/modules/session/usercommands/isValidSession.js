var mage = require('../../../mage');
var logger = mage.core.logger;

exports.access = 'anonymous';
exports.params = ['sessionKey'];

exports.execute = function (state, sessionKey, cb) {
	sessionKey = sessionKey || '';

	mage.session.resolve(state, sessionKey, function (err, session) {
		if (err) {
			return cb(err);
		}

		logger.debug
			.data('key', sessionKey)
			.data('session', session || 'none')
			.log('Validating key');

		state.respond(session !== undefined);
		return cb();
	});
};

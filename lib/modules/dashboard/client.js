var EventEmitter = require('emitter');
var session = require('session');

exports = module.exports = new EventEmitter();

exports.startAnonymousSession = function (cb) {
	if (!exports.loginAnonymous) {
		var error = new Error('Anonymous sessions are not enabled.');
		console.log(error);

		if (cb) {
			cb(error);
		}
		return;
	}

	exports.loginAnonymous(function (error, data) {
		if (error) {
			if (cb) {
				cb(error);
			}
			return;
		}

		session.setSessionKey(data.session);
		session.actorId = data.actorId;

		if (cb) {
			cb();
		}
	});
};

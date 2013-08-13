var EventEmitter = require('emitter');
var mage = require('mage');

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

		mage.session.setSessionKey(data.session);
		mage.session.actorId = data.actorId;

		if (cb) {
			cb();
		}
	});
};

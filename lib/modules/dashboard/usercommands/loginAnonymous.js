var mage = require('../../../mage');
var uuid = require('node-uuid');


exports.access = 'anonymous';
exports.params = [];


exports.execute = function (state, cb) {
	if (!mage.isDevelopmentMode()) {
		return state.error('auth', 'Anonymous access only possible when developmentMode is enabled.', cb);
	}

	var actorId = uuid();

	mage.session.register(state, actorId, null, { access: 'admin' }, function (error, session) {
		if (error) {
			return cb(error);
		}

		var data = { session: session.getFullKey(), actorId: actorId };

		state.respond(data);

		cb();
	});
};

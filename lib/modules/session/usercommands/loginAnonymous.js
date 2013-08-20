var mage = require('../../../mage');
var uuid = require('node-uuid');


exports.access = 'anonymous';
exports.params = ['access'];


exports.execute = function (state, access, cb) {
	if (!mage.isDevelopmentMode()) {
		// access may only be anonymous

		if (mage.core.access.compare(access, 'anonymous') > 0) {
			return state.error('auth', 'Non-anonymous access only possible when developmentMode is enabled.', cb);
		}
	}

	var actorId = uuid();

	mage.session.register(state, actorId, null, { access: access }, cb);
};

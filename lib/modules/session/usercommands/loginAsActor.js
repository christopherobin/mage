var mage = require('../../../mage');

// Unauthenticated login as a particular actor

// If executed by an authenticated user, its session will be tested for admin access.
// Alternatively, developmentMode will need to be turned on.

exports.access = 'anonymous';
exports.params = ['actorId', 'access'];


exports.execute = function (state, actorId, access, cb) {
	var isAdmin = (state.session && state.session.meta && state.session.meta.access === 'admin');

	if (!isAdmin && !mage.isDevelopmentMode()) {
		return state.error('auth', 'Unauthenticated login only possible for admins or when developmentMode is enabled.', cb);
	}

	mage.session.register(state, actorId, null, { access: access }, cb);
};

var mage = require('../../../mage');

// Unauthenticated login as a particular actor

// If executed by an authenticated user, its session will be tested for admin access.
// Alternatively, developmentMode will need to be turned on.

exports.access = 'anonymous';
exports.params = ['actorId', 'access'];


exports.execute = function (state, actorId, access, cb) {
	if (!actorId) {
		return state.error(null, 'Missing actorId', cb);
	}

	if (!mage.isDevelopmentMode('loginAs')) {
		return state.error(null, 'Identity change is only allowed in development mode.', cb);
	}

	var allowCustomAccess = mage.isDevelopmentMode('customAccessLevel');
	var adminEverywhere = mage.isDevelopmentMode('adminEverywhere');

	var defaultAccess = adminEverywhere ? 'admin' : 'anonymous';

	access = access || defaultAccess;

	// test for custom access level requests

	if (!allowCustomAccess && access !== defaultAccess) {
		return state.error('auth', 'Custom access level is only possible in development mode.', cb);
	}

	mage.session.register(state, actorId, null, { access: access }, cb);
};

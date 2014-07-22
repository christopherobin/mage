var mage = require('../../../mage');
var uuid = require('node-uuid');

exports.access = 'anonymous';
exports.params = ['access'];

exports.execute = function (state, access, cb) {
	var allowCustomAccess = mage.isDevelopmentMode('customAccessLevel');
	var adminEverywhere = mage.isDevelopmentMode('adminEverywhere');

	var defaultAccess = adminEverywhere ? 'admin' : 'anonymous';

	access = access || defaultAccess;

	// test for custom access level requests

	if (!allowCustomAccess && access !== defaultAccess) {
		return state.error('auth', 'Custom access level is only possible in development mode.', cb);
	}

	var actorId = uuid();

	mage.session.register(state, actorId, null, { access: access });

	cb();
};

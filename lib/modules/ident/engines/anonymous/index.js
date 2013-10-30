var mage = require('../../../../mage');
var uuid = require('node-uuid');
var util = require('util');
var Engine = require('../engine').Engine;

// we can singleton that one
var instance;

function Anonymous(cfg, logger) {
	// do nothing
	this.cfg = cfg;
	this.logger = logger;
}

util.inherits(Anonymous, Engine);

// do the actual authentication
Anonymous.prototype.auth = function (state, params, cb) {
	var access = params.access || this.cfg.access;

	// non anonymous levels are not allowed when not in development mode
	if (!mage.isDevelopmentMode()) {
		if (mage.core.access.compare(access, 'anonymous') > 0) {
			return state.error('auth', 'Non-anonymous access only possible when developmentMode is enabled.', cb);
		}
	}

	var actorId = params.actorId || uuid.v4();

	mage.session.register(state, actorId, null, { access: access }, cb);
};

/**
 *
 * @param cfg
 * @param logger
 * @param cb
 */
exports.setup = function (cfg, logger, cb) {
	if (!instance) {
		instance = new Anonymous(cfg, logger);
	}

	cb(null, instance);
};
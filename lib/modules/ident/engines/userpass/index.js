var mage = require('../../../../mage');
var uuid = require('node-uuid');
var crypto = require('crypto');

function noop(password) {
	return password;
}

function UserPassword(cfg, logger) {
	// do nothing
	this.cfg = cfg;
	this.logger = logger;

	this.cfg.topic = this.cfg.topic || 'credentials';

	mage.core.archivist.assertTopicAbilities(this.cfg.topic, ['username'], ['set', 'get']);

	// allow password encryption, default is plaintext
	this.hash = noop;

	// then support for classic hashing
	if (this.cfg.hash) {
		this.hash = function (password) {
			return crypto.createHash(this.cfg.hash).update(password).digest('hex');
		};
	}

	// support for hmac
	if (this.cfg.hmac) {
		this.hash = function (password) {
			return crypto.createHmac(this.cfg.hmac.algorithm, this.cfg.hmac.key)
				.update(password).digest('hex');
		};
	}
}

// do the actual authentication
UserPassword.prototype.auth = function (state, params, cb) {
	var that = this;

	// load the access level
	var access = this.cfg.access;

	this.logger.debug.data(params).log('Trying authentication with username and password');

	if (!params.username || !params.password) {
		return cb(new Error('Missing parameters for user/password authentication'));
	}

	var options = { optional: true, mediaTypes: ['application/json'] };
	var index =  { username: params.username };

	// retrieve user from archivist
	state.archivist.get(this.cfg.topic, index, options, function (err, data) {
		if (err) {
			return cb(err);
		}

		// we don't want to give too much details about why it failed
		if (!data || (that.hash(params.password) !== data.password)) {
			return cb(new Error('Invalid credentials'));
		}

		// if no uuid is set, create one right now
		if (!data.actorId) {
			data.actorId = uuid.v4();
			state.archivist.set(that.cfg.topic, index, data);
		}

		// now register the session
		mage.session.register(state, data.actorId, null, { access: access }, cb);
	});
};

/**
 *
 * @param cfg
 * @param logger
 * @param cb
 */
exports.setup = function (cfg, logger, cb) {
	var instance;

	try {
		instance = new UserPassword(cfg, logger);

		// don't allow plaintext passwords on production
		if (!mage.isDevelopmentMode() && (instance.hash === noop)) {
			throw new Error('Plaintext passwords are not allowed on production');
		}
	} catch (err) {
		return cb(err);
	}

	cb(null, instance);
};
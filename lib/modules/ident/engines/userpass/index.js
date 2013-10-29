var mage = require('../../../../mage');
var uuid = require('node-uuid');
var crypto = require('crypto');
var async = require('async');


function UserPassword(cfg, logger) {
	var that = this;

	// do nothing
	this.cfg = cfg;
	this.logger = logger;

	this.cfg.topic = this.cfg.topic || 'credentials';

	mage.core.archivist.assertTopicAbilities(this.cfg.topic, ['username'], ['set', 'get']);

	// then support for classic hashing. remember that classic hashing is weak, even with a salt,
	// you should use hmac or pbkdf2 if possible
	if (this.cfg.hash) {
		this.hash = function (password, salt) {
			// get our hash function
			var hash = crypto.createHash(that.cfg.hash);

			// feed it the salt if there is one
			if (salt) {
				hash.update(new Buffer(salt, 'hex'));
			}

			// feed it the password
			hash.update(password);

			return (salt ? salt + '$' : '') + hash.digest('hex');
		};
	}

	// support for hmac
	if (this.cfg.hmac) {
		this.hash = function (password, salt) {
			var hash = crypto.createHmac(this.cfg.hmac.algorithm, this.cfg.hmac.key + new Buffer(salt, 'hex'));

			// feed it the salt if there is one
			if (salt) {
				hash.update(new Buffer(salt, 'hex'));
			}

			// feed it the password
			hash.update(password);

			return (salt ? salt + '$' : '') + hash.digest('hex');
		};
	}

	// support for pbkdf2, this is the recommended way to hash passwords but is kinda slow, we may
	// want to limit password length to a certain length, see this issue in django about why:
	// https://www.djangoproject.com/weblog/2013/sep/15/security/
	if (this.cfg.pbkdf2) {
		if (!this.cfg.salt) {
			throw new Error('pbkdf2 needs salts to be enabled');
		}

		// do NOT change the iteration count once you use it (maybe store it in the credentials
		// table to prevent issues?) or you will not be able to verify credential entries created
		// with the old iteration count!
		var iterations = this.cfg.pbkdf2.iterations || 12000;

		if (!this.cfg.pbkdf2.iterations) {
			this.logger.warning('Please setup how many iterations you want to use with pbkdf2.');
		}

		this.hash = function (password, salt) {
			return (salt ? salt + '$' : '') + crypto.pbkdf2Sync(password, new Buffer(salt, 'hex'), iterations, 20)
				.toString('hex');
		};
	}
}

function getSalt(instance, password) {
	// are salts enabled?
	if (instance.cfg.salt) {
		return password.substring(0, password.indexOf('$'));
	}
	return '';
}

// do the actual authentication
UserPassword.prototype.auth = function (state, params, cb) {
	var that = this;

	// load the access level
	var access = this.cfg.access;

	this.logger.debug.data(params).log('Trying authentication with username and password');

	if (!params.username || !params.password) {
		return state.error('auth', new Error('Missing parameters for user/password authentication'), cb);
	}

	var options = { optional: true, mediaTypes: ['application/json'] };
	var index =  { username: params.username };

	// retrieve user from archivist
	state.archivist.get(this.cfg.topic, index, options, function (err, data) {
		if (err) {
			return cb(err);
		}

		// get the salt from the stored password
		var salt = getSalt(that, data.password);

		// we don't want to give too much details about why it failed
		if (!data || (that.hash(params.password, salt) !== data.password)) {
			return state.error('auth', new Error('Invalid credentials'), cb);
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

UserPassword.prototype.createUser = function (state, username, password, meta, cb) {
	var that = this;

	if (typeof meta === 'function') {
		cb = meta;
		meta = undefined;
	}

	if (!username) {
		return cb(new Error('Missing username for command createUser'));
	}

	if (!password) {
		return cb(new Error('Missing password for command createUser'));
	}

	var options = { optional: true };
	var index =  { username: username };

	// retrieve user from archivist
	state.archivist.get(this.cfg.topic, index, options, function (err, data) {
		// user exists
		if (data) {
			return cb(new Error('User ' + username + ' already exists'));
		}

		var salt = '';

		async.series([
			function (cb) {
				// if salts are enabled, create a nice salt
				if (!that.cfg.salt) {
					return cb();
				}

				// TODO: salts should be the length (in bits) of the generated hash for hmac, but there
				// is no easy way to do determine that length beside hashing a password and measuring
				// what we get, 256bits should be enough for general purposes

				crypto.randomBytes(32, function (err, buf) {
					if (err) {
						return cb(err);
					}

					// convert it to hexadecimal for storage
					salt = buf.toString('hex');
					cb();
				});
			}
		], function () {
			var userData = {
				username: username,
				password: that.hash(password, salt)
			};

			if (meta) {
				userData.meta = meta;
			}

			state.archivist.set(that.cfg.topic, index, userData);

			cb(null, { success: true });
		});
	});
};

UserPassword.prototype.run = function (state, command, params, cb) {
	params = params || {};

	switch (command) {
	case 'createUser':
		return this.createUser(state, params.username, params.password, cb);
	}

	cb(new Error('Unknown command ' + command + ' sent to engine UserPass'));
};


/**
 * Setup function for userpass engine for the ident module
 *
 * @param {object} cfg - Configuration for ident module
 * @param {object} logger - Mage logger
 * @param {function} cb - Callback function
 */
exports.setup = function (cfg, logger, cb) {
	var instance;

	try {
		instance = new UserPassword(cfg, logger);

		if (!instance.hash) {
			throw new Error('Hash type not defined in config for passwords');
		}
	} catch (err) {
		return cb(err);
	}

	cb(null, instance);
};

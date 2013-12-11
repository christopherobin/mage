var mage = require('../../../../mage');
var uuid = require('node-uuid');
var crypto = require('crypto');
var util = require('util');
var Engine = require('../engine').Engine;


function createHash(cfg) {
	return function (password, salt) {
		var hash = crypto.createHash(cfg);

		if (salt) {
			hash.update(new Buffer(salt, 'hex'));
		}

		hash.update(password);

		return hash.digest('hex');
	};
}

function createHmac(cfg) {
	return function (password, salt) {
		// throwing the salt with the key adds slightly more entropy
		var hash = crypto.createHmac(cfg.algorithm, cfg.key + new Buffer(salt, 'hex'));

		// feed it the salt if there is one
		if (salt) {
			hash.update(new Buffer(salt, 'hex'));
		}

		// feed it the password
		hash.update(password);

		return hash.digest('hex');
	};
}

function createPbkdf2(cfg, logger) {
	// support for pbkdf2, this is the recommended way to hash passwords but is kinda slow, we may
	// want to limit password length to a certain length, see this issue in django about why:
	// https://www.djangoproject.com/weblog/2013/sep/15/security/

	// do NOT change the iteration count once you use it (maybe store it in the credentials
	// table to prevent issues?) or you will not be able to verify credential entries created
	// with the old iteration count!
	var iterations = cfg.iterations || 12000;

	if (!cfg.iterations) {
		logger.warning(
			'Please set up how many iterations you want to use with pbkdf2,',
			' defaulting to', iterations, 'iterations.');
	}

	return function (password, salt) {
		if (!salt) {
			return false;
		}

		return crypto.pbkdf2Sync(password, new Buffer(salt, 'hex'), iterations, 20).toString('hex');
	};
}


function UserPassword(cfg, logger) {
	this.cfg = cfg;
	this.logger = logger;

	this.cfg.topic = this.cfg.topic || 'credentials';

	mage.core.archivist.assertTopicAbilities(this.cfg.topic, ['username'], ['set', 'get']);

	// Set up a hash function based on config

	// Remember that classic hashing is weak, even with a salt,
	// you should use hmac or pbkdf2 if possible

	if (this.cfg.hash) {
		this.hash = createHash(this.cfg.hash, this.logger);
	} else if (this.cfg.hmac) {
		this.hash = createHmac(this.cfg.hmac, this.logger);
	} else if (this.cfg.pbkdf2) {
		this.hash = createPbkdf2(this.cfg.pbkdf2, this.logger);
	} else {
		throw new Error('Please configure either "hash", "hmac" or "pbkdf2".');
	}
}

util.inherits(UserPassword, Engine);


UserPassword.prototype.auth = function (state, credentials, cb) {
	var username = credentials.username;
	var password = credentials.password;

	if (!username || !password) {
		return state.error('ident', 'Missing parameters for user/password authentication', cb);
	}

	var that = this;

	var options = { optional: true, mediaTypes: ['application/json'] };
	var index =  { username: username };

	// retrieve user from archivist
	state.archivist.get(this.cfg.topic, index, options, function (error, data) {
		if (error) {
			return cb(error);
		}

		// we don't want to give too much details about why it failed
		if (!data || (that.hash(password, data.salt) !== data.password)) {
			return state.error('ident', 'Invalid credentials', cb);
		}

		var userId = data.actorId || uuid.v4();

		// if no uuid is set, create one right now
		if (!data.actorId) {
			data.actorId = userId;
			state.archivist.set(that.cfg.topic, index, data);
		}

		cb(null, userId, { username: username });
	});
};

/**
 * Create a new user in the current topic
 *
 * @param {State}    state    The current state
 * @param {string}   username The username
 * @param {string}   password The user password
 * @param {Object}   [meta]   Some metadata to store on the user
 * @param {Function} cb
 * @returns {*}
 */
UserPassword.prototype.createUser = function (state, username, password, meta, cb) {
	var that = this;

	if (typeof meta === 'function') {
		cb = meta;
		meta = undefined;
	}

	if (!username) {
		return state.error('ident', 'Missing username for command createUser', cb);
	}

	if (!password) {
		return state.error('ident', 'Missing password for command createUser', cb);
	}

	var options = { optional: true };
	var index =  { username: username };

	// retrieve user from archivist
	state.archivist.get(this.cfg.topic, index, options, function (error, data) {
		if (error) {
			return cb(error);
		}

		// user exists
		if (data) {
			return state.error('ident', 'User ' + username + ' already exists', cb);
		}

		// create a salt, 32 bytes (256 bits) is a safe default, you just want something that is
		// long enough so that salt + password is probably not in a hash database
		var saltSize = that.cfg.saltSize || 32;

		crypto.randomBytes(saltSize, function (err, buf) {
			if (err) {
				return state.error('ident', err, cb);
			}

			// convert it to hexadecimal for storage
			var salt = buf.toString('hex');

			var userData = {
				username: username,
				password: that.hash(password, salt),
				salt: salt
			};

			if (meta) {
				userData.meta = meta;
			}

			state.archivist.set(that.cfg.topic, index, userData);

			cb();
		});
	});
};

UserPassword.prototype.run = function (state, command, params, cb) {
	params = params || {};

	switch (command) {
	case 'createUser':
		return this.createUser(state, params.username, params.password, cb);
	}

	state.error('ident', 'Unknown command ' + command + ' sent to engine UserPass', cb);
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

var mage = require('../../../../mage');
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


function UserPassword(name, cfg, logger) {
	this.name = name;
	this.cfg = cfg;
	this.logger = logger;

	this.cfg.topic = this.cfg.topic || 'credentials';

	mage.core.archivist.assertTopicAbilities(this.cfg.topic, ['userId'], ['set', 'get']);

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


UserPassword.prototype.usernameToUserId = function (username) {
	if (!username) {
		throw new Error('Missing username');
	}

	if (typeof username !== 'string') {
		throw new TypeError('Username must be a string');
	}

	return this.name + ':' + username;
};


UserPassword.prototype.getUserDoc = function (state, userId, optional, cb) {
	if (!userId) {
		return state.error('ident', 'Missing userId', cb);
	}

	var options = { optional: !!optional, mediaTypes: ['application/json'] };

	state.archivist.get(this.cfg.topic, { userId: userId }, options, cb);
};


UserPassword.prototype.getUser = function (state, userId, cb) {
	this.getUserDoc(state, userId, false, function (error, doc) {
		if (error) {
			return cb(error);
		}

		// only return the user part, not the credentials
		cb(null, doc.user);
	});
};


UserPassword.prototype.auth = function (state, credentials, cb) {
	var userId = this.usernameToUserId(credentials.username);
	var password = credentials.password;

	if (!password) {
		return state.error('ident', 'Missing password', cb);
	}

	var that = this;

	this.getUserDoc(state, userId, true, function (error, doc) {
		if (error) {
			return cb(error);
		}

		if (!doc || !doc.credentials || that.hash(password, doc.credentials.salt) !== doc.credentials.password) {
			return state.error('ident', 'Invalid credentials', cb);
		}

		return cb(null, doc.user);
	});
};


/**
 * Create a new user in the current topic
 *
 * @param {State}    state
 * @param {Object}   credentials
 * @param {string}   credentials.username  The unique username for this user
 * @param {string}   credentials.password  The user's password
 * @param {Object}   user
 * @param {string}   [user.displayName]    The display name for this user (credentials.username is used by default)
 * @param {Object}   [user.data]           Extra data to store on the user
 * @param {Function} cb
 */
UserPassword.prototype.createUser = function (state, credentials, user, cb) {
	var that = this;

	credentials = credentials || {};
	user = user || {};

	if (!credentials.username) {
		return state.error('ident', 'Missing username', cb);
	}

	if (typeof credentials.username !== 'string') {
		return state.error('ident', 'Username must be a string', cb);
	}

	if (!credentials.password) {
		return state.error('ident', 'Missing password', cb);
	}

	if (typeof credentials.password !== 'string') {
		return state.error('ident', 'Password must be a string', cb);
	}

	var userId = this.usernameToUserId(credentials.username);

	var options = { optional: true };
	var index =  { userId: userId };

	state.archivist.get(this.cfg.topic, index, options, function (error, currentDoc) {
		if (error) {
			return cb(error);
		}

		if (currentDoc) {
			return state.error('ident', 'User ' + userId + ' already exists', cb);
		}

		// create a salt, 32 bytes (256 bits) is a safe default, you just want something that is
		// long enough so that salt + password is probably not in a hash database

		var saltSize = that.cfg.saltSize || 32;

		crypto.randomBytes(saltSize, function (error, salt) {
			if (error) {
				return state.error('ident', error, cb);
			}

			var doc = {
				credentials: {
					username: credentials.username,
					password: that.hash(credentials.password, salt),
					salt: salt.toString('hex')
				},
				user: {
					userId: userId,
					displayName: user.displayName || credentials.username,
					data: user.data || {},
					// add username, as its no secret:
					username: credentials.username
				}
			};

			state.archivist.set(that.cfg.topic, index, doc);

			cb(null, doc.user);
		});
	});
};


UserPassword.prototype.listUsers = function (state, cb) {
	state.archivist.list('credentials', {}, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		var items = indexes.map(function (index) {
			return { topic: 'credentials', index: index };
		});

		state.archivist.mget(items, { mediaTypes: ['application/json'] }, function (error, docs) {
			if (error) {
				return cb(error);
			}

			docs = docs.map(function (doc) {
				return doc.user;
			});

			cb(null, docs);
		});
	});
};


/**
 * Setup function for userpass engine for the ident module
 *
 * @param {string}   name   The name given to the instance
 * @param {Object}   cfg    Configuration for ident module
 * @param {Object}   logger Mage logger
 * @param {Function} cb     Callback function
 */
exports.setup = function (name, cfg, logger, cb) {
	var instance;

	try {
		instance = new UserPassword(name, cfg, logger);
	} catch (error) {
		return cb(error);
	}

	cb(null, instance);
};

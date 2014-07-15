var assert = require('assert');
var crypto = require('crypto');
var util = require('util');
var uuid = require('node-uuid');

var mage = require('../../../../mage');

var Engine = require('../engine');
var hashes = require('./hashes');

function UserPassword(name, cfg, logger) {
	this.name = name;
	this.cfg = cfg;
	this.logger = logger;

	this.cfg.topic = this.cfg.topic || 'userpass';

	mage.core.archivist.assertTopicAbilities(this.cfg.topic, ['username'], ['set', 'get']);

	// Set up a hash function based on config

	// Remember that classic hashing is weak, even with a salt,
	// you should use hmac or pbkdf2 if possible

	var hashName;

	for (var id in hashes) {
		if (hashes.hasOwnProperty(id) && this.cfg.hasOwnProperty(id)) {
			hashName = id;
			break;
		}
	}

	assert(hashName, 'Please configure this userpass engine with: "hash", "hmac" or "pbkdf2".');

	this.hashMethod = hashes[hashName](this.cfg[hashName], this.logger);
}

util.inherits(UserPassword, Engine);


UserPassword.prototype.getUser = function (state, username, cb) {
	if (!username) {
		return cb('invalidUsername');
	}

	var topic = this.cfg.topic;
	var index =  { username: username };
	var options = { optional: true, mediaTypes: ['application/json'] };

	state.archivist.get(topic, index, options, function (error, user) {
		if (!user) {
			error = 'invalidUsername';
		}

		cb(error, user);
	});
};


UserPassword.prototype.auth = function (state, credentials, cb) {
	try {
		this.ensureCredentials(credentials);
	} catch (e) {
		mage.logger.error.data(e).log('Invalid credentials');
		return cb(e);
	}

	var that = this;

	this.getUser(state, credentials.username, function (error, user) {
		if (error) {
			return cb(error);
		}

		try {
			assert.equal(that.hashMethod(credentials.password, user.salt), user.password, 'invalidPassword');
		} catch (e) {
			return cb(e);
		}

		return cb(null, user.userId);
	});
};


/**
 * Create a new user in the current topic
 *
 * @param {State}    state
 * @param {Object}   credentials
 * @param {string}   credentials.username  The unique username for this user
 * @param {string}   credentials.password  The user's password
 * @param {Object}   [userId]              The userId for this user
 * @param {Function} cb
 */
UserPassword.prototype.createUser = function (state, credentials, userId, cb) {
	try {
		this.ensureCredentials(credentials);
	} catch (e) {
		return cb(e);
	}

	var username = credentials.username;
	userId = userId || uuid.v4();

	var that = this;

	this.getUser(state, username, function (error, user) {
		if (user) {
			return cb('alreadyExists');
		}

		if (error & error !== 'invalidUsername') {
			mage.logger.error(error);
			return cb(error);
		}

		var newUser = {
			username: username,
			userId: userId
		};

		// create a salt, 32 bytes (256 bits) is a safe default, you just want something that is
		// long enough so that salt + password is probably not in a hash database

		var saltSize = that.cfg.saltSize || 32;

		crypto.randomBytes(saltSize, function (error, salt) {
			if (error) {
				return cb(error);
			}

			newUser.password = that.hashMethod(credentials.password, salt);
			newUser.salt = salt.toString('hex');

			var topic = that.cfg.topic;
			var index =  { username: username };

			state.archivist.set(topic, index, newUser);

			var authSource = {};
			authSource[that.name] = username;

			mage.ident.addAuthSources(state, userId, authSource, that.cfg.doNotCreate, function (error) {
				cb(error, userId);
			});
		});
	});
};


UserPassword.prototype.listUsers = function (state, cb) {
	var topic = this.cfg.topic;

	state.archivist.list(topic, {}, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		var items = indexes.map(function (index) {
			return { topic: topic, index: index };
		});

		state.archivist.mget(items, { mediaTypes: ['application/json'] }, function (error, users) {
			if (error) {
				return cb(error);
			}

			var userIds = users.map(function (user) {
				return user.userId;
			});

			cb(null, userIds);
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

var mage = require('mage');
var Tome = require('tomes').Tome;
var uuid = require('node-uuid');

exports.setName = require('./name').set;

var IDENT_ENGINE = 'testEngine';

function createUser(state, userId) {
	var newUser = {
		id: userId,
		lastLogin: mage.time.now(),
		name: ''
	};

	var tUser = Tome.conjure(newUser);

	state.archivist.set('user', { userId: userId }, tUser);
}

function get(state, userId, cb) {
	state.archivist.get('user', { userId: userId }, { optional: true }, function (error, tUser) {
		if (!error && !tUser) {
			error = 'invalidUserId';
		}

		cb(error, tUser);
	});
}

function loggedIn(tUser) {
	tUser.lastLogin.assign(mage.time.now());
}

exports.create = function (state, password, cb) {
	var username = uuid.v4();

	var credentials = {
		username: username,
		password: password
	};

	var engine = mage.ident.getEngine(IDENT_ENGINE);

	engine.createUser(state, credentials, username, function (error, userId) {
		if (error) {
			mage.logger.error('failed to create user in the engine');
			return cb(error);
		}

		createUser(state, userId);

		cb(null, userId);
	});
};

exports.get = get;

exports.login = function (state, username, password, cb) {
	var credentials = {
		username: username,
		password: password
	};

	mage.logger.debug('Attempting to login as: ' + username);

	mage.ident.login(state, IDENT_ENGINE, credentials, function (error, session) {
		if (error) {
			mage.logger.error('Failed to login in ident: ' + error);
			return cb(error);
		}

		var userId = session.actorId;

		get(state, userId, function (error, tUser) {
			if (error) {
				return cb(error);
			}

			loggedIn(tUser);

			var result = {
				meta: session.meta,
				sessionKey: session.getFullKey(),
				userId: userId
			};

			cb(null, result);
		});
	});
};

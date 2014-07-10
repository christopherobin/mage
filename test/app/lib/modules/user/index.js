var mage = require('mage');
var Tome = require('tomes').Tome;
var uuid = require('node-uuid');

exports.setName = require('./name').set;

var IDENT_ENGINE = 'testEngine';

function banCheck(state, engineName, doc, cb) {
	if (doc.data.banned) {
		return cb('banned');
	}

	cb();
}

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

exports.ban = function (state, username, cb) {
	var engine = mage.ident.getEngine(IDENT_ENGINE);

	var userId = engine.usernameToUserId(username);

	engine.getUser(state, userId, function (error, doc) {
		if (error) {
			return cb(error);
		}

		doc.data.banned = true;

		engine.updateUser(state, userId, doc, function (error) {
			if (error) {
				return cb(error);
			}

			mage.session.getActorSession(state, userId, function (error, session) {
				if (error === 'noSession') {
					return cb();
				} else if (error) {
					return cb(error);
				}

				session.expire(state);

				cb();
			});
		});
	});
};

exports.unban = function (state, username, cb) {
	var engine = mage.ident.getEngine(IDENT_ENGINE);

	var userId = engine.usernameToUserId(username);

	engine.getUser(state, userId, function (error, doc) {
		if (error) {
			return cb(error);
		}

		delete doc.data.banned;

		engine.updateUser(state, userId, doc, cb);
	});
};

exports.create = function (state, password, cb) {
	var credentials = {
		username: uuid.v4(),
		password: password
	};

	var engine = mage.ident.getEngine(IDENT_ENGINE);

	engine.createUser(state, credentials, null, function (error, doc) {
		if (error) {
			return cb(error);
		}

		var userId = doc.userId;

		createUser(state, userId);

		cb(null, credentials.username);
	});
};

exports.get = get;

exports.login = function (state, username, password, cb) {
	var credentials = {
		username: username,
		password: password
	};

	mage.ident.login(state, IDENT_ENGINE, credentials, null, function (error, session) {
		if (error) {
			return cb(error);
		}

		var userId = session.actorId;

		get(state, userId, function (error, tUser) {
			if (error) {
				return cb(error);
			}

			loggedIn(tUser);

			var result = {
				sessionKey: session.getFullKey(),
				userId: userId,
				meta: session.meta
			};

			cb(null, result);
		});
	});
};

exports.setup = function (state, cb) {
	mage.ident.registerPostLoginHook(IDENT_ENGINE, banCheck);

	cb();
};

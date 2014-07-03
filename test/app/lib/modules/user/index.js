var mage = require('mage');
var Tome = require('tomes').Tome;
var uuid = require('node-uuid');

exports.setName = require('./name').set;

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

function login(tUser) {
	tUser.lastLogin.assign(mage.time.now());
}

function loginHook(state, engineName, doc, cb) {
	var userId = doc.userId;

	get(state, userId, function (error, tUser) {
		if (error) {
			return cb(error);
		}

		login(tUser);

		cb();
	});
}

exports.create = function (state, password, cb) {
	var credentials = {
		username: uuid.v4(),
		password: password
	};

	var engine = mage.ident.getEngine('testEngine');

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

exports.setup = function (state, cb) {
	mage.ident.registerPostLoginHook('testEngine', loginHook);

	cb();
};

var mage = require('mage');
var Tome = require('tomes').Tome;
var uuid = require('node-uuid');

function createUser(state, userId) {
	var newUser = {
		id: userId,
		lastLogin: mage.time.now()
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
	var userId = doc.username;

	get(state, userId, function (error, tUser) {
		if (error) {
			return cb(error);
		}

		login(tUser);

		cb();
	});
}

exports.create = function (state, password, cb) {
	var userId = uuid.v4();

	var credentials = {
		username: userId,
		password: password
	};

	var engine = mage.ident.getEngine('testEngine');

	engine.createUser(state, credentials, null, function (error) {
		if (error) {
			return cb(error);
		}

		createUser(state, userId);

		cb(null, userId);
	});
};

exports.get = get;

exports.setup = function (state, cb) {
	mage.ident.registerPostLoginHook('testEngine', loginHook);

	cb();
};

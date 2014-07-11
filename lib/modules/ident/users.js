var Tome = require('tomes').Tome;
var uuid = require('node-uuid');

var mage = require('../../mage');

var cfg = mage.core.config.get(['module', 'ident'], {});
var topic = cfg.topic || 'ident';

function get(state, userId, cb) {
	var index = { userId: userId };
	var options = { optional: true };

	state.archivist.get(topic, index, options, function (error, tUser) {
		if (!error && !tUser) {
			error = 'invalidUserId';
		}

		cb(error, tUser);
	});
}

exports.get = get;

function create(state, userId, authSources, cb) {
	userId = userId || uuid.v4();

	var index = { userId: userId };

	get(state, userId, function (error, tUser) {
		if (tUser) {
			return cb('alreadyExists');
		}

		if (error === 'invalidUserId') {
			var newUser = {
				id: userId,
				engines: {}
			};

			if (authSources) {
				for (var engineName in authSources) {
					if (authSources.hasOwnProperty(engineName)) {
						newUser.engines[engineName] = authSources[engineName];
					}
				}
			}

			tUser = Tome.conjure(newUser);

			state.archivist.set(topic, index, tUser);
		}

		cb(null, tUser);
	});
}

exports.create = create;

exports.addAuthSources = function (state, userId, authSources, doNotCreate, cb) {
	get(state, userId, function (error, tUser) {
		if (error === 'invalidUserId' && doNotCreate) {
			mage.logger.debug('Not creating user.');
			return cb('notCreatingUser');
		}

		if (error && error !== 'invalidUserId') {
			mage.logger.error(error);
			return cb(error);
		}

		if (tUser) {
			for (var engineName in authSources) {
				if (authSources.hasOwnProperty(engineName)) {
					tUser.engines.set(engineName, authSources[engineName]);
				}
			}

			return cb();
		}

		create(state, userId, authSources, cb);
	});
};

exports.ban = function (state, userId, reason, cb) {
	get(state, userId, function (error, tUser) {
		if (error) {
			return cb(error);
		}

		reason = reason || true;

		tUser.set('banned', reason);

		mage.session.getActorSession(state, userId, function (error, session) {
			if (error === 'noSession') {
				return cb();
			}

			if (error) {
				return cb(error);
			}

			session.expire(state);

			cb();
		});
	});
};

exports.unban = function (state, userId, cb) {
	get(state, userId, function (error, tUser) {
		if (error) {
			return cb(error);
		}

		if (tUser.hasOwnProperty('banned')) {
			tUser.del('banned');
		}

		cb();
	});
};

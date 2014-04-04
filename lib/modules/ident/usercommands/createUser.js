var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['engineName', 'credentials', 'user'];

exports.execute = function (state, engineName, credentials, user, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.createUser(state, credentials, user, function (error, user) {
		if (error) {
			return cb(error);
		}

		state.respond(user);

		cb();
	});
};

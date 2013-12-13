var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['engineName'];

exports.execute = function (state, engineName, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(state, engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.listUsers(state, function (error, users) {
		if (error) {
			return cb(error);
		}

		state.respond(users);

		cb();
	});
};

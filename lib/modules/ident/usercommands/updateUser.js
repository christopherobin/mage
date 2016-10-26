var mage = require('../../../mage');

exports.acl = ['admin'];

exports.params = ['engineName', 'username', 'changes'];

exports.execute = function (state, engineName, username, changes, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.updateUser(state, username, changes, function (error) {
		if (error) {
			return state.error('ident', error, cb);
		}

		cb();
	});
};

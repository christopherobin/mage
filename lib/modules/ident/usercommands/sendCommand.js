var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engineName', 'command', 'params'];

exports.execute = function (state, engineName, command, params, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.run(state, command, params || {}, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data) {
			state.respond(data);
		}

		cb();
	});
};

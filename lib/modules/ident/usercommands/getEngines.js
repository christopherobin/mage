var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = [];

exports.execute = function (state, cb) {
	// check if the engine is available
	mage.ident.getEngines(state.appName, function (err, engines) {
		if (err) {
			return state.error('ident', err, cb);
		}

		state.respond(engines);

		cb();
	});
};

var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engine', 'params'];

exports.execute = function (state, engine, params, cb) {
	// check if the engine is available
	mage.ident.check(state, engine, params, cb);
};

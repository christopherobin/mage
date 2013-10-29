var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engine', 'command', 'params'];

exports.execute = function (state, engine, command, params, cb) {
	// check if the engine is available
	mage.ident.sendCommand(state, engine, command, params, cb);
};

var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['engine', 'command', 'params'];

exports.execute = function (state, engine, command, params, cb) {
	// send the command to the engine
	mage.ident.sendCommand(state, engine, command, params, cb);
};

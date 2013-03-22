var EventEmitter = require('emitter');
var msgServer = require('msgServer');

exports = module.exports = new EventEmitter();

exports.setSessionKey = function (key) {
	exports.key = key;
	exports.emit('sessionKey.set', key);
};

msgServer.registerCommandHook('mage.session', function () {
	return { key: exports.key };
});
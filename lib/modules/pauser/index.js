// Client side module.

var mage = require('../../mage');
var logger = mage.core.logger;

exports.setup = function (state, cb) {
	logger.warning.details('Locks: https://github.com/Wizcorp/locks').log('The pauser module has been deprecated, and replaced by the Locks component.');
	cb();
};

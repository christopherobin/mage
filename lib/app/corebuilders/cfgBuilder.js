var mage = require('../../mage');


exports.build = function (buildTarget, clientConfig, contextName, data, cb) {
	cb(null, JSON.stringify(mage.core.config.get([data], '')));
};
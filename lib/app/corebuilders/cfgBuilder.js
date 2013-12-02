var mage = require('../../mage');


exports.build = function (buildTarget, clientConfig, req, contextName, data, cb) {
	cb(null, JSON.stringify(mage.core.config.get(data.split('.'), '')));
};
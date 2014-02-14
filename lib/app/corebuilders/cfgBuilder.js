var mage = require('../../mage');

exports.build = function (buildTarget, clientConfig, req, contextName, data, cb) {
	var out = mage.core.config.get(data, '');

	if (contextName === 'js') {
		out = JSON.stringify(out);
	}

	return cb(null, out + '');
};

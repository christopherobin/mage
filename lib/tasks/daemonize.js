var daemon = require('../daemon');

exports.start = function (mage, options) {
	var fn = daemon[options.command];

	if (!fn) {
		throw new Error('There is no daemonizer command called "' + options.command + '"');
	}

	fn.call(daemon);
};

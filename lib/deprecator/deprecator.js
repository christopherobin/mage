var logger;

/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} mageInstance A mage instance.
 * @param {Object} mageLogger   A mage logger.
 */

exports.initialize = function (mageLogger) {
	logger = mageLogger;
};

var handlers = {};


exports.trigger = function (name) {
	var handler = handlers[name];

	if (handler) {
		handler();
	} else {
		logger.alert('Failed to describe deprecation of:', name);
	}
};

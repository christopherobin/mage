var mage = require('mage');


exports.setup = function (state, callback) {
	return callback();
};


mage.core.httpServer.addRoute('/stallforever', function () {
	// never finish
}, 'simple');

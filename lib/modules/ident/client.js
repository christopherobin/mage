var mage = require('mage');

exports.user = null;

mage.eventManager.on('io.ident.login', function (user) {
	exports.user = user;
});

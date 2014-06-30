var mage = require('mage');

exports.user = null;

mage.httpServer.on('io.ident.login', function (user) {
	exports.user = user;
});

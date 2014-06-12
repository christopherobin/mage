var mage = require('mage');

exports.user = null;

mage.msgServer.on('io.ident.login', function (user) {
	exports.user = user;
});

mage.httpServer.on('io.ident.login', function (user) {
	exports.user = user;
});

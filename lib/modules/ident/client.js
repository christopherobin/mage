var mage = require('mage');

exports.user = null;

mage.httpServer.on('io.ident.login', function (response) {
	exports.user = response.user;

	var info = response.session;
	mage.session.setSessionKey(info.key, info.actorId);
});

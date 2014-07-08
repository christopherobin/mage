var mage = require('mage');

exports.user = null;

function loggedIn(response) {
	exports.user = response.user;
}

mage.eventManager.on('io.ident.login', loggedIn);
mage.eventManager.on('io.ident.restoreSession', loggedIn);

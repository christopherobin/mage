var mage = require('mage.js');

exports.user = null;

function loggedIn(path, info) {
	exports.user = info;
}

function loggedOut() {
	exports.user = null;
}

mage.eventManager.on('session.set', loggedIn);
mage.eventManager.on('session.unset', loggedOut);

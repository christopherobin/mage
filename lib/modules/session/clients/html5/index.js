// This file has been componentized.
// It is now the session module.
//  - lib/modules/session/component.json
//  - lib/modules/session/client.js

(function () {

	// session module

	var mage = window.mage;

	if (!mage.io) {
		console.warn('Could not find mage.io library.');
		return;
	}

	var mod = mage.registerModule($html5client('module.session.construct'));

	mod.setSessionKey = function (key) {
		mod.emit('sessionKey.set', key);

		mage.io.registerCommandHook('mage.session', function () {
			return { key: key };
		});
	};

}());

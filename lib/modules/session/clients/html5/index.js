(function () {

	// session module

	var mage = window.mage;

	if (!mage.io) {
		console.warn('Could not find mage.io library.');
		return;
	}

	var mod = mage.registerModule($html5client('module.session.construct'));


	mod.setSessionKey = function (key) {
		mod.key = key;
		mod.emit('sessionKey.set', key);
	};


	mage.io.registerCommandHook('mage.session', function () {
		return { key: mod.key };
	});

}());

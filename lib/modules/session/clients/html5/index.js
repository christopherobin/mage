(function () {

	// session module

	var mithril = window.mithril;

	if (!mithril.io) {
		console.warn('Could not find mithril.io library.');
		return;
	}

	var mod = mithril.registerModule($html5client('module.session.construct'));


	mod.setSessionKey = function (key) {
		mod.key = key;
		mod.emit('sessionKey.set', key);
	};


	mithril.io.registerCommandHook('mithril.session', function () {
		return { key: mod.key };
	});

}());

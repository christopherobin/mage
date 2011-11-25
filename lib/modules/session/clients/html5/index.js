(function () {

	// session module

	var mithril = window.mithril;

	if (!mithril.io) {
		console.warn('Could not find mithril.io library.');
		return;
	}

	var mod = {};

	mithril.registerModule('session', mod);


	mod.setSessionKey = function (key) {
		mod.key = key;
	};


	mithril.io.registerCommandHook('mithril.session', function (message) {
		return {
			header: { name: 'mithril.session', key: mod.key },
			message: message
		};
	});

}());

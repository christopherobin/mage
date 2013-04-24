// This file has been componentized.
// It is now the session module.
//  - lib/modules/session/component.json
//  - lib/modules/session/client.js

(function () {

	// session module

	var mage = window.mage;
	var actorId;

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

	mod.startAnonymousSession = function (cb) {
		if (!mod.randomSession) {
			return console.log('Anonymous sessions are not enabled.');
		}

		mod.randomSession(function (error, data) {
			if (error) {
				if (cb) {
					cb(error);
				}
				return;
			}

			mod.setSessionKey(data.session);
			actorId = data.actorId;

			if (cb) {
				cb();
			}
		});
	};

	mod.getActorId = function () {
		return actorId;
	};
}());

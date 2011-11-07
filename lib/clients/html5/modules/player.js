(function () {

	var mithril = window.mithril;

	var mod = {
		me: {}
	};

	mithril.registerModule('player', mod);


	mod.sync = function (cb) {
		mithril.io.send('player.sync', {}, null, function (errors, response) {
			if (errors) {
				return cb(errors);
			}

			mithril.helpers.replaceObj(mod.me, response.me);

			cb();
		});
	};


	mod.setup = function (cb) {
		mod.me.actor = mithril.actor.me;

		mod.sync(cb);
	};


	mod.myLanguage = function () {
		return mod.me.language || 'EN';
	};


	mod.getPlayer = function (playerId, fields, cb) {
		mithril.io.send('player.getPlayer', { playerId: playerId, fields: fields }, cb);
	};

}());

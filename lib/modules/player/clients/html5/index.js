(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.player.construct'));

	mod.me = {};


	mod.setup = function (cb) {
		mod.me.actor = mithril.actor.me;

		mod.sync(function (errors, response) {
			if (errors) {
				return cb(errors);
			}

			mithril.helpers.replaceObj(mod.me, response.me);

			cb();
		});
	};


	mod.myLanguage = function () {
		return mod.me.language || 'EN';
	};

}());

(function () {

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.player.construct'));

	mod.me = {};


	mod.setup = function (cb) {
		mod.me.actor = mage.actor.me;

		if (!mod.sync) {
			return cb();
		}

		mod.sync(function (errors, response) {
			if (errors) {
				return cb(errors);
			}

			mage.helpers.replaceObj(mod.me, response.me);

			cb();
		});
	};


	mod.myLanguage = function () {
		return mod.me.language || 'EN';
	};

}());

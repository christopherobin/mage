(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.actor.construct'));

	mod.me = {};


	mod.setup = function (cb) {
		mod.sync(function (error, result) {
			if (error) {
				return cb(error);
			}

			var me = result.me;

			mithril.datatypes.transformProperties(me.data);

			mithril.helpers.replaceObj(mod.me, me);

			cb();
		});
	};

}());

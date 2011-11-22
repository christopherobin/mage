(function () {

	var mithril = window.mithril;

	var mod = {
		me: {}
	};

	mithril.registerModule('actor', mod);


	// user commands

	mod.sync = function (cb) {
		mithril.io.send('actor.sync', {}, null, function (errors, result) {
			if (errors) {
				return cb(errors);
			}

			var me = result.me;

			mithril.datatypes.transformProperties(me.data);

			mithril.helpers.replaceObj(mod.me, me);

			cb();
		});
	};


	mod.getActor = function (actorId, fields, cb) {
		mithril.io.send('actor.getActor', { actorId: actorId, fields: fields }, null, cb);
	};


	// setup

	mod.setup = function (cb) {
		mod.sync(cb);
	};

}());

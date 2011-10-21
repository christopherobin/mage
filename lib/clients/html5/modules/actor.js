(function () {

	var mithril = window.mithril;

	var mod = {
		me: {}
	};

	mithril.registerModule('actor', mod);


	mod.setup = function (cb) {
		mithril.io.send('actor.sync', {}, function (errors, result) {
			if (errors) {
				return cb(errors);
			}

			mithril.helpers.replaceObj(mod.me, result.me);

			cb();
		});
	};


	mod.getActor = function (actorId, fields, cb) {
		mithril.io.send('actor.getActor', { actorId: actorId, fields: fields }, cb);
	};

}());

(function () {

	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.dashboard.construct'));


	mod.startAnonymousSession = function (cb) {
		if (!mod.loginAnonymous) {
			var error = 'Anonymous sessions are not enabled.';
			console.log(error);

			if (cb) {
				cb(error);
			}
			return;
		}

		mod.loginAnonymous(function (error, data) {
			if (error) {
				if (cb) {
					cb(error);
				}
				return;
			}

			mage.session.setSessionKey(data.session);
			mage.session.actorId = data.actorId;

			if (cb) {
				cb();
			}
		});
	};

}());

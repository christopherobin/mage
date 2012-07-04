(function (window) {
	var mithril = window.mithril,
		schedulerServer = mithril.registerModule($html5client('module.schedulerServer.construct'));

	// Are we set up?
	var setup = false;
	schedulerServer.onceSetup = function (cb) {
		if (setup) {
			cb();
		} else {
			schedulerServer.once('setup', cb);
		}
	};

	schedulerServer.once('setup', function () {
		setup = true;
	});

	// Hook up to Mithril
	mithril.once('setup.schedulerServer', function () {
		schedulerServer.emit('setup');
	});

	mithril.loader.on('schedulerServer.display', function () {
		schedulerServer.emit('display');
	});

	mithril.setupModules(['schedulerServer']);
}(window));

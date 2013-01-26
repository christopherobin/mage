(function (window) {
	var mage = window.mage,
	    schedulerServer = mage.registerModule($html5client('module.schedulerServer.construct'));

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

	// Hook up to MAGE
	mage.once('setup.schedulerServer', function () {
		schedulerServer.emit('setup');
	});

	mage.loader.on('schedulerServer.display', function () {
		schedulerServer.emit('display');
	});

	mage.setupModules(['schedulerServer']);
}(window));
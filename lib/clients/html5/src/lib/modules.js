(function (window) {

	var mithril = window.mithril;

	// set up module system

	var setupQueue = [];
	var modules = {};


	mithril.registerModule = function (cfg) {
		var name = cfg.name;

		if (typeof name !== 'string') {
			console.error('Mithril.registerModule() expects cfg to contain a name.', cfg);
			return;
		}

		if (mithril.hasOwnProperty(name)) {
//			console.error('Failed to register module "', name, '". A module by that name already exists.');
			return modules[name];
		}

		var mod = new mithril.EventEmitter();

		if (cfg.construct) {
			// create the module as a result of calling api()
			// it should contain all exposed user commands

			cfg.construct.call(null, mithril.io, mod);
		}

		modules[name] = mithril[name] = mod;

		mithril.emit('created.' + name, mod);

		setupQueue.push(name);

		return mod;
	};


	function setupModule(modName, cb) {
		var mod = modules[modName];

		if (mod) {
			if (mod.hasOwnProperty('setup')) {
				mod.setup.call(mod, function (error) {
					if (error) {
						return cb(error);
					}

					mithril.emit('setup.' + modName, mod);
					cb();
				});
			} else {
				mithril.emit('setup.' + modName, mod);
				cb();
			}
		} else {
			cb();
		}
	}


	function setupModules(modNames, cb) {
		// batch send:

		function finalCb() {
			mithril.emit('setupComplete');

			if (cb) {
				cb();
				cb = null;
			}
		}

		var done = 0;
		var len = modNames.length;

		if (len === 0) {
			finalCb();
		} else {
			for (var i = 0; i < len; i++) {
				setupModule(modNames[i], function () {
					done++;

					if (done === len) {
						finalCb();
					}
				});
			}
		}
	}


	mithril.setupModules = function (modNames, cb) {
		// remove all given module names from the current setupQueue

		var newSetupQueue = [];	// replacement array for setupQueue
		var toSetup = [];	// the modNames that we'll end up setting up

		for (var i = 0, len = setupQueue.length; i < len; i++) {
			var queuedModName = setupQueue[i];

			var index = modNames.indexOf(queuedModName);
			if (index === -1) {
				newSetupQueue.push(queuedModName);
			} else {
				toSetup.push(queuedModName);
			}
		}

		setupQueue = newSetupQueue;

		setupModules(toSetup, cb);
	};


	// expose the setup method, to be called after configure()
	// mithril.setup sets up all modules yet to be set up,
	// after which it emits the event 'setup'

	mithril.setup = function (cb) {
		setupModules(setupQueue, cb);
	};

}(window));

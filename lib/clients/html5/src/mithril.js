(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mithril = window.mithril = new window.EventEmitter();

	mithril.EventEmitter = window.EventEmitter;
	mithril.plugins = {};


	// expose configuration set up
	// mithril.configure registers the configuration and emits 'configure'

	mithril.configure = function (config) {
		mithril.config = config;

		if (mithril.loader) {
			mithril.appName = mithril.loader.appName || null;
		}

		mithril.emit('configure', config);
	};


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
			console.error('Failed to register module "', name, '". A module by that name already exists.');
			return;
		}

		var mod;

		if (cfg.api) {
			// create the module as a result of calling api()
			// it should contain all exposed user commands

			mod = cfg.api.call(null, mithril.io);
		} else {
			mod = {};
		}

		modules[name] = mithril[name] = mod;

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

					mithril.emit('setup', modName);
					cb();
				});
			} else {
				mithril.emit('setup', modName);
				cb();
			}
		} else {
			cb();
		}
	}


	function setupModules(modNames, cb) {
		(function next(error) {
			if (error) {
				return cb(error);
			}

			var modName = modNames.shift();

			if (modName) {
				setupModule(modName, next);
			} else {
				cb();
			}
		}());
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

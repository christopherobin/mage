// This file has been componentized
// Merged into main mage component
//  - component.json
//  - lib/client.js

(function (window) {

	var mage = window.mage;

	// set up module system

	var setupQueue = [];
	var modules = {};


	mage.getModule = function (name) {
		return modules[name] || null;
	};


	mage.registerModule = function (cfg) {
		var name = cfg.name;

		if (typeof name !== 'string') {
			console.error('mage.registerModule() expects cfg to contain a name.', cfg);
			return;
		}

		if (mage.hasOwnProperty(name)) {
			console.error('Failed to register module "', name, '". A module by that name already exists.');
			return;
		}

		var mod = new mage.EventEmitter();

		if (cfg.construct) {
			// create the module as a result of calling api()
			// it should contain all exposed user commands

			cfg.construct.call(null, mage.io, mod);
		}

		modules[name] = mage[name] = mod;

		mage.emit('created.' + name, mod);

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

					mage.emit('setup.' + modName, mod);
					cb();
				});
			} else {
				mage.emit('setup.' + modName, mod);
				cb();
			}
		} else {
			cb();
		}
	}


	function setupModules(modNames, cb) {
		var done = 0;
		var len = modNames.length;

		function finalCb() {
			mage.emit('setupComplete');

			if (cb) {
				cb();
				cb = null;
			}
		}

		function stepCb() {
			done++;

			if (done === len) {
				finalCb();
			}
		}

		if (len === 0) {
			finalCb();
		} else {
			for (var i = 0; i < len; i++) {
				setupModule(modNames[i], stepCb);
			}
		}
	}


	mage.setupModules = function (modNames, cb) {
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
	// mage.setup sets up all modules yet to be set up,
	// after which it emits the event 'setup'

	mage.setup = function (cb) {
		setupModules(setupQueue, cb);
	};

}(window));

(function () {

	if (!window.mithril) {
		window.mithril = {};
	}

	var mithril = window.mithril;


	// expose configuration set up

	mithril.setup = function (config) {
		mithril.config = config;

		if (mithril.loader) {
			mithril.appName = mithril.loader.appName || null;
		}
	};


	// set up module system

	var setupQueue = [];


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

		mithril[name] = mod;

		setupQueue.push(mod);

		return mod;
	};


	function setupModules(cb) {
		(function next(error) {
			if (error) {
				return cb(error);
			}

			var mod = setupQueue.shift();

			if (mod) {
				if (mod.hasOwnProperty('setup')) {
					mod.setup.call(mod, next);
				} else {
					next();
				}
			} else {
				cb();
			}
		}());
	}


	// expose the start method, to be called after setup()

	mithril.start = function (cb) {
		mithril.io.start();

		setupModules(cb);
	};

}());

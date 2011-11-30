(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mithril = window.mithril = new window.EventEmitter();

	mithril.EventEmitter = window.EventEmitter;


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


	// expose the setup method, to be called after configure()
	// mithril.setup sets up all modules yet to be set up,
	// after which it emits the event 'setup'

	mithril.setup = function (cb) {
		setupModules(function () {
			mithril.emit('setup');

			cb();
		});
	};

}(window));

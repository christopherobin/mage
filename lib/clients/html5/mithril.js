(function () {

	if (!window.mithril) {
		window.mithril = {};
	}

	var mithril = window.mithril;

	if (mithril.mui) {
		mithril.packageName = mithril.mui.packageName || null;
	}


	// expose configuration set up

	mithril.setup = function (config) {
		mithril.config = config;
	};


	// set up module system

	var setupQueue = [];


	mithril.registerModule = function (name, module) {
		if (mithril.hasOwnProperty(name)) {
			console.error('Failed to register module "', name, '". A module by that name already exists.');
		} else {
			mithril[name] = module;

			setupQueue.push(module);
		}
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

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

	mithril.modules = [];


	mithril.registerModule = function (name, module) {
		mithril.modules.push({ name: name, module: module });
		mithril[name] = module;
	};


	function setupModules(cb) {
		var done = 0;
		var tasks = [];

		for (var i = 0, len = mithril.modules.length; i < len; i++) {
			var mod = mithril.modules[i].module;

			if (mod.setup) {
				tasks.push(mod);
			}
		}

		if (tasks.length === 0) {
			return cb();
		}

		var next = function (error) {
			if (error) {
				return cb(error);
			}

			var task = tasks.shift();

			if (task) {
				task.setup.call(task, next);
			} else {
				cb();
			}
		};

		next();
	}


	// expose the start method, to be called after setup()

	mithril.start = function (cb) {
		mithril.io.start();

		setupModules(cb);
	};

}());

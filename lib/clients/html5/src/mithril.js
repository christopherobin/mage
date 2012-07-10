(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mithril = window.mithril = new window.EventEmitter();

	mithril.EventEmitter = window.EventEmitter;
	mithril.plugins = {};
	mithril.appVariants = $app('variants');
	mithril.appName = $app('name');
	mithril.densities = mithril.appVariants.densities.filter(function (value) {
		return value <= window.devicePixelRatio;
	});

	// default values (game loader and/or preferences page will override these)
	var language = mithril.appVariants.languages[0],
		density  = mithril.appVariants.densities[0];

	mithril.getLanguage = function () {
		return language;
	};

	mithril.getDensity = function () {
		return density;
	};

	mithril.setLanguage = function (value) {
		if (mithril.appVariants.languages.indexOf(value.toLowerCase()) !== -1) {
			language = value;
			mithril.emit('languageChanged', value);
		}
	};

	mithril.setDensity = function (value) {
		if (mithril.appVariants.densities.indexOf(value) !== -1) {
			density = value;
			mithril.emit('densityChanged', value);
		}
	};

	// expose configuration set up
	// mithril.configure registers the configuration and emits 'configure'

	mithril.configure = function (config) {
		mithril.config = config;

		mithril.emit('configure', config);
	};

}(window));

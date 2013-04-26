// This file has been componentized
//  - component.json
//  - lib/client.js

(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mage = window.mage = new window.EventEmitter();

	mage.EventEmitter = window.EventEmitter;
	mage.appVariants = $app('variants');
	mage.appName = $app('name');
	mage.plugins = {};

	mage.getClientHostBaseUrl = function () {
		return $app('clientHostBaseUrl');
	};

	mage.densities = mage.appVariants.densities.filter(function (value) {
		return value <= window.devicePixelRatio;
	});

	// default values (game loader and/or preferences page will override these)
	var language = mage.appVariants.languages[0],
		density  = mage.appVariants.densities[0];

	mage.getLanguage = function () {
		return language;
	};

	mage.getDensity = function () {
		return density;
	};

	mage.setLanguage = function (value) {
		if (mage.appVariants.languages.indexOf(value.toLowerCase()) !== -1) {
			language = value;
			mage.emit('languageChanged', value);
		}
	};

	mage.setDensity = function (value) {
		if (mage.appVariants.densities.indexOf(value) !== -1) {
			density = value;
			mage.emit('densityChanged', value);
		}
	};

	// expose configuration set up
	// mage.configure registers the configuration and emits 'configure'

	mage.configure = function (config) {
		mage.config = config;

		mage.emit('configure', config);
	};

	mage.isDevelopmentMode = function () {
		return $app('developmentMode');
	};

}(window));

(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mage = window.mage = new window.EventEmitter();

	var clientHostBaseUrl = {
		protocol: 'http',
		host: $cfg('server.clientHost.expose.host'),
		port: $cfg('server.clientHost.expose.port') || 80,
		authUser: $cfg('server.clientHost.expose.authUser'),
		authPass: $cfg('server.clientHost.expose.authPass')
	};

	mage.EventEmitter = window.EventEmitter;
	mage.appVariants = $app('variants');
	mage.appName = $app('name');
	mage.plugins = {};

	mage.getClientHostBaseUrl = function (parsed) {
		if (parsed) {
			return clientHostBaseUrl;
		}

		var baseUrl = clientHostBaseUrl.protocol + '://';

		if (clientHostBaseUrl.authUser && clientHostBaseUrl.authPass) {
			baseUrl += clientHostBaseUrl.authUser + ':' + clientHostBaseUrl.authPass + '@';
		}

		baseUrl += clientHostBaseUrl.host + ':' + clientHostBaseUrl.port;

		return baseUrl;
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

}(window));

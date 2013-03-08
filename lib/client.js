var EventEmitter = require('emitter');
var inherits = require('inherit');


function Mage(mageConfig) {
	EventEmitter.call(this);

	this.appVariants = mageConfig.appVariants;
	this.clientHostBaseUrl = mageConfig.clientHostBaseUrl;
	this.appName = mageConfig.appName;
	this.plugins = {};
	this.language = mageConfig.appVariants.languages[0];
	this.density = mageConfig.appVariants.densities[0];

	var MsgServer = require('msgServer').MsgServer;
	this.msgServer = new MsgServer(mageConfig);

	// when a mage setup branch completes, the required transport may have become available

	var that = this;

	// when a session key is available, start the event system
	// if the key changes, make the event system aware (by simply calling setupEventSystem again)
	// before the change, the event stream was probably paused due to an "auth" error.

	this.once('created.session', function (session) {
		session.on('sessionKey.set', function (key) {
			that.msgServer.setupEventSystem(key);
		});
	});

	this.on('setupComplete', function () {
		that.msgServer.setupEventSystem();
	});
}


inherits(Mage, EventEmitter);


Mage.prototype.getClientHostBaseUrl = function (unparsed) {
	var clientHostBaseUrl = this.clientHostBaseUrl;

	if (unparsed) {
		return clientHostBaseUrl;
	}

	var baseUrl = clientHostBaseUrl.protocol + '://';

	if (clientHostBaseUrl.authUser && clientHostBaseUrl.authPass) {
		baseUrl += clientHostBaseUrl.authUser + ':' + clientHostBaseUrl.authPass + '@';
	}

	baseUrl += clientHostBaseUrl.host + ':' + clientHostBaseUrl.port;

	return baseUrl;
};


Mage.prototype.densities = function () {
	var densities = [];
	for (var i = 0; i < this.appVariants.densities.length; i += 1) {
		if (this.appVariants.densities[i] <= window.devicePixelRatio) {
			densities.push(this.appVariants.densities[i]);
		}
	}
	return densities;
};


Mage.prototype.getDensity = function () {
	return this.density;
};


Mage.prototype.setDensity = function (value) {
	if (this.appVariants.densities.indexOf(value) !== -1) {
		this.density = value;
		this.emit('densityChanged', value);
	}
};


Mage.prototype.getLanguage = function () {
	return this.language;
};


Mage.prototype.setLanguage = function (value) {
	if (this.appVariants.languages.indexOf(value.toLowerCase()) !== -1) {
		this.language = value;
		this.emit('languageChanged', value);
	}
};


// expose configuration set up
// mage.configure registers the configuration and emits 'configure'

Mage.prototype.configure = function (config) {
	this.config = config;

	// override default config, this may fire as often as desired

	var opts = config ? config.io : null;

	if (opts) {
		for (var key in opts) {
			this.msgServer.cfg[key] = opts[key];
		}
	}

	// set up command system

	this.msgServer.setupCommandSystem();
};


exports.Mage = Mage;
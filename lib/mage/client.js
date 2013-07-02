var EventEmitter = require('emitter');
var inherits = require('inherit');
var MsgServer = require('msgServer');

function Mage() {
	EventEmitter.call(this);

	this.configure(window.mageConfig);

	this.msgServer = this.io = new MsgServer(this.appName, this.clientHostBaseUrl, this.config);

	return this;
}

inherits(Mage, EventEmitter);


Mage.prototype.getClientHostBaseUrl = function () {
	return this.clientHostBaseUrl;
};

Mage.prototype.getSavvyBaseUrl = function () {
	return this.savvyBaseUrl;
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

Mage.prototype.configure = function (mageConfig) {
	if (!mageConfig) {
		throw new Error('Mage requires a config to be instantiated.');
	}

	var that = this;

	this.config = mageConfig;

	this.appVariants = mageConfig.appVariants;
	this.clientHostBaseUrl = mageConfig.clientHostBaseUrl;
	this.savvyBaseUrl = mageConfig.savvyBaseUrl;
	this.appName = mageConfig.appName;
	this.language = mageConfig.appVariants.languages[0];
	this.density = mageConfig.appVariants.densities[0];

	// when a session key is available, start the event system
	// if the key changes, make the event system aware (by simply calling setupEventSystem again)
	// before the change, the event stream was probably paused due to an "auth" error.

	this.once('created.session', function (session) {
		session.on('sessionKey.set', function (key) {
			that.msgServer.setupEventSystem(key);
		});
	});
};


Mage.prototype.isDevelopmentMode = function () {
	return this.config.developmentMode;
};


// And here comes the module system.

var setupQueue = [];
var modules = {};

function setupModule(mage, modName, cb) {
	var mod = modules[modName];

	if (!mod) {
		return cb();
	}

	if (!mod.hasOwnProperty('setup')) {
		mage.emit('setup.' + modName, mod);
		return cb();
	}

	mod.setup.call(mod, function (error) {
		if (error) {
			return cb(error);
		}

		mage.emit('setup.' + modName, mod);
		return cb();
	});
}

function setupModules(mage, modNames, cb) {
	var done = 0;
	var len = modNames.length;

	var lastError;

	function finalCb() {
		mage.emit('setupComplete');

		if (cb) {
			cb(lastError);
			cb = null;
		}
	}

	function stepCb(error) {
		lastError = error || lastError;
		done++;

		if (done === len) {
			finalCb();
		}
	}

	if (len === 0) {
		return finalCb();
	}

	for (var i = 0; i < len; i++) {
		setupModule(mage, modNames[i], stepCb);
	}
}

function createUserCommand(modParams, execPath, modRequirements) {
	var msgServer = '\tvar msgServer = require(\'mage\').msgServer;\n';
	var params = '\tvar params = { ';
	var separator = '';

	for (var i = 0; i < modParams.length; i += 1) {
		params = params.concat(separator, modParams[i], ': ', modParams[i]);
		separator = ', ';
	}

	params = params.concat(' };\n');

	var requirements = '{';
	separator = '';
	for (var req in modRequirements) {
		requirements = requirements.concat(separator, req, ': ', JSON.stringify(modRequirements[req]));
		separator = ', ';
	}

	requirements = requirements.concat(' }');

	var msgServerSend = '\tmsgServer.send(';
	msgServerSend = msgServerSend.concat(JSON.stringify(execPath), ', params, ', requirements, ', cb);\n');

	modParams.push('cb');

	var callback = '\tif (typeof cb !== \'function\') { cb = function () {}; }\n';

	/*jshint evil:true */
	var userCommand = new Function(modParams.join(', '), msgServer + params + msgServerSend + callback);

	return userCommand;
}


Mage.prototype.useModules = function () {
	var appRequire = arguments[0];

	window.appRequire = appRequire;

	if (typeof appRequire !== 'function') {
		throw new TypeError('useModules: the first argument must be require.');
	}

	var userCommands = this.config.userCommands;
	var execPaths = Object.keys(userCommands);

	for (var i = 1; i < arguments.length; i += 1) {
		var name = arguments[i];

		if (modules.hasOwnProperty(name)) {
			console.error('Failed to register module "' + name + '". A module by that name already exists.');
			return;
		}

		if (this.hasOwnProperty(name)) {
			console.error('Failed to register module "' + name + '". This is a reserved name.');
			return;
		}

		var hasImplementation = !!window.require.resolve(appRequire.resolve(name));
		var mod = hasImplementation ? appRequire(name) : {};

		modules[name] = this[name] = mod;

		for (var j = 0; j < execPaths.length; j += 1) {
			var execPath = execPaths[j];
			var uc = userCommands[execPath];

			if (uc.gameModule === name) {
				hasImplementation = true;

				mod[uc.cmdName] = createUserCommand(uc.mod.params || [], execPath, uc.requirements);
			}
		}

		if (!hasImplementation) {
			console.error('Module "' + name + '" has no implementation.');
		}

		this.emit('created.' + name, mod);

		setupQueue.push(name);
	}

	return this;
};


Mage.prototype.setupModules = function (modNames, cb) {
	// remove all given module names from the current setupQueue

	var newSetupQueue = [];	// replacement array for setupQueue
	var toSetup = [];	// the modNames that we'll end up setting up

	for (var i = 0; i < setupQueue.length; i += 1) {
		var queuedModName = setupQueue[i];

		if (modNames.indexOf(queuedModName) === -1) {
			newSetupQueue.push(queuedModName);
		} else {
			toSetup.push(queuedModName);
		}
	}

	setupQueue = newSetupQueue;

	setupModules(this, toSetup, cb);
};

// expose the setup method, to be called after configure()
// mage.setup sets up all modules yet to be set up,
// after which it emits the event 'setup'

Mage.prototype.setup = function (cb) {
	this.setupModules(setupQueue, cb);
};


module.exports = new Mage();
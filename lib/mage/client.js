var EventEmitter = require('emitter');
var inherits = require('inherit');
var msgServer = require('msgServer');

function Mage() {
	EventEmitter.call(this);
	this.configure(window.mageConfig);
	this.io = msgServer;
	return this;
}

inherits(Mage, EventEmitter);


Mage.prototype.getClientHostBaseUrl = function () {
	return this.clientHostBaseUrl;
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

	this.config = mageConfig;

	this.appVariants = mageConfig.appVariants;
	this.clientHostBaseUrl = mageConfig.clientHostBaseUrl;
	this.appName = mageConfig.appName;
	this.language = mageConfig.appVariants.languages[0];
	this.density = mageConfig.appVariants.densities[0];

	// when a session key is available, start the event system
	// if the key changes, make the event system aware (by simply calling setupEventSystem again)
	// before the change, the event stream was probably paused due to an "auth" error.

	this.once('created.session', function (session) {
		session.on('sessionKey.set', function (key) {
			msgServer.setupEventSystem(key);
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
	var msgServer = '\tvar msgServer = require(\'msgServer\');\n';
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
	if (typeof appRequire !== 'function') {
		throw new TypeError('useModules: the first argument must be require.');
	}

	for (var i = 1; i < arguments.length; i += 1) {
		var name = arguments[i];

		if (this.hasOwnProperty(name)) {
			console.error('Failed to register module "' + name + '". A module by that name already exists.');
			return;
		}

		var mod = modules[name] = this[name] = appRequire(name);

		for (var execPath in this.config.userCommands) {
			var userCommand = this.config.userCommands[execPath];
			if (userCommand.gameModule !== name) {
				continue;
			}

			var cmdName = userCommand.cmdName;
			var modParams = userCommand.mod.params || [];
			var requirements = userCommand.requirements;

			mod[cmdName] = createUserCommand(modParams, execPath, requirements);
		}

		this.emit('created.' + name, mod);

		setupQueue.push(name);
	}

	return this;
};


Mage.prototype.registerModule = function (cfg) {
	var name = cfg.name;

	var msgServer = require('msgServer');

	if (typeof name !== 'string') {
		console.error('mage.registerModule() expects cfg to contain a name.', cfg);
		return;
	}

	if (this.hasOwnProperty(name)) {
		console.error('Failed to register module "' + name + '". A module by that name already exists.');
		return;
	}

	var mod = new EventEmitter();

	if (cfg.construct) {
		cfg.construct.call(null, msgServer, mod);
	}

	modules[name] = this[name] = mod;

	this.emit('created.' + name, mod);

	setupQueue.push(name);

	return mod;
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
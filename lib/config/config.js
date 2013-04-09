var path = require('path');
var fs = require('fs');

var helpers;

/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} help The helper library.
 */

exports.initialize = function (help) {
	helpers = help;
};


function Config() {
	this._cfg = null;
}

exports.Config = Config;


// configuration value shortcut function, returns null if not found.

Config.prototype.get = function (route, altValue) {
	if (arguments.length < 2) {
		altValue = null;
	}

	var cfg = this._cfg;

	if (!cfg) {
		return altValue;
	}

	route = route.split('.');

	for (var i = 0, len = route.length; i < len; i++) {
		cfg = cfg[route[i]];

		if (!cfg) {
			return altValue;
		}
	}

	return cfg;
};


function loadConfigFile(pathConfig) {
	if (typeof pathConfig !== 'string') {
		throw new Error('loadConfigFile requires a filename.');
	}

	var data;
	var resolved = path.resolve(pathConfig);

	try {
		data = fs.readFileSync(resolved, 'utf8');
	} catch (error) {
		throw new Error('Could not find configuration file: ' + pathConfig + ' (resolved to: ' + resolved + ').');
	}

	try {
		data = helpers.lintingJsonParse(data);
	} catch (parseError) {
		throw new Error('JSON Parse Error in ' + resolved + ':\n' + parseError.message);
	}

	return data;
}


function mergeObjects(a, b) {
	// merges b's keys into a

	for (var key in b) {
		if (a.hasOwnProperty(key)) {
			if (typeof b[key] === 'object' && b[key] !== null) {
				// have b's sub object extend a's

				mergeObjects(a[key], b[key]);
			} else {
				// have b's sub value overwrite a's

				a[key] = b[key];
			}
		} else {
			// add the new property to a

			a[key] = b[key];
		}
	}
}


Config.prototype.add = function (pathConfig) {
	if (Array.isArray(pathConfig)) {
		for (var i = 0, len = pathConfig.length; i < len; i++) {
			this.add(pathConfig[i]);
		}
		return;
	}

	var data = loadConfigFile(pathConfig);

	if (this._cfg) {
		if (data && typeof data === 'object') {
			mergeObjects(this._cfg, data);
		}
	} else {
		this._cfg = data;
	}
};


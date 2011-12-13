var path = require('path'),
    fs = require('fs');


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
	var data;

	try {
		data = fs.readFileSync(pathConfig, 'utf8');
	} catch (e1) {
		throw 'Could not find configuration file: ' + pathConfig + ' (resolved to: ' + path.resolve(pathConfig) + ').';
	}

	try {
		data = JSON.parse(data);
	} catch (e2) {
		throw 'Syntax error in configuration file. Run "nodelint ' + path.resolve(pathConfig) + '" to check for errors.';
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


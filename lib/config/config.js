var jsYaml = require('js-yaml');
var path = require('path');
var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Container = require('./Container');

function isObject(val) {
	return !!(val && typeof val === 'object' && !Array.isArray(val));
}

// Config is split into three level. In order of descending importance:
// 
// - User/prod config file.
// - Default config file.
// - Module level defaults.
// 







function Config(moduleDefaults, defaultConfig, userConfig) {
	EventEmitter.call(this);

	this.moduleDefaults = new Container(moduleDefaults);
	this.moduleDefaults = new Container(defaultConfig);
	this.moduleDefaults = new Container(userConfig);

	this.merged = {};
}

util.inherits(Config, EventEmitter);


Config.prototype.get = function(route, alt) {
	var path = Array.isArray(route) ? modPath.slice().reverse() : route.split('.').reverse();

	while (path.length && conf) {
		conf = conf[path.pop()];
	}

	if (conf === undefined) {
		conf = alt;
	}

	return conf;
};


Config.prototype.setModuleDefault = function (modName, defaults) {
	this.moduleDefaults[modName] = defaults;
	this.merge();
};





require('js-yaml');
var config = require('config');
var path = require('path');

// Alias setModuleDefaults to setTopLevelDefault.
config.setTopLevelDefault = config.setModuleDefaults;

// To avoid confusion, we delete the original reference.
delete config.setModuleDefaults;

// If the DEVELOPMENT_MODE environment variable is set to 'true' or 'false', it overrides other
// configuration. To activate development mode be a config file, the top level `developmentMode` key
// must be assigned a boolean `true` value. Anything else will be changed to `false`.
switch (process.env.DEVELOPMENT_MODE) {
case 'true':
	config.developmentMode = true;
	break;
case 'false':
	config.developmentMode = false;
	break;
default:
	config.developmentMode = config.developmentMode === true;
}

/**
 * Define setModuleDefault so that it places additions under "modules" top level key.
 *
 * @param {String} modName  Name of module.
 * @param {Object} defaults An object with default parameters.
 */

config.setModuleDefault = function (modName, defaults) {
	var topDefault = {};
	topDefault[modName] = defaults;
	config.setTopLevelDefault('module', topDefault);
};


/**
 * Method to set top level defaults en masse.
 *
 * @param {Object} defaults A default object to use as configuration.
 */

config.setDefaults = function (defaults) {
	Object.keys(defaults).forEach(function (library) {
		config.setTopLevelDefault(library, defaults[library]);
	});
};


/**
 * Safe getting. The path is a list of keys down to the configuration wanted. If an undefined is
 * hit at any point, alt is returned instead. Use *sparingly*! Most of the time you can use default
 * config via setModuleDefault. Very occasionally you won't know the config until run time, and this
 * can be handy for such a case.
 *
 * @param  {Array|String} modPath Config path.
 * @return {*}                    Data resulting from get.
 */

config.get = function (modPath, alt) {
	var path = Array.isArray(modPath) ? modPath.slice().reverse() : modPath.split('.').reverse();
	var conf = config;

	while (path.length && conf) {
		conf = conf[path.pop()];
	}

	if (conf === undefined) {
		conf = alt;
	}

	return conf;
};


/**
 * A helper function for game modules. This attempts to resolve and load a file called config.yaml
 * or config.json. A lack of a configuration file leads to no effect, and files with a weird
 * extention or that cannot be parsed will throw.
 *
 * @param {String} modName Name of the module.
 * @param {String} modPath Path to the module.
 */

config.loadModuleConfig = function (modName, modPath) {
	var configPath = null;

	try {
		configPath = require.resolve(path.join(modPath, 'config'));
	} catch (e) {}

	// If no configuration path could be resolved, return now.
	if (!configPath) {
		return;
	}

	var allowed = ['.yaml', '.json'];
	var extension = path.extname(configPath);

	if (allowed.indexOf(extension) === -1) {
		throw new Error('Default configuration for module ' + modName + ' is not a valid type: ' + extension + ' for configuration path: ' + configPath);
	}

	var defaultConf = require(configPath);

	if (defaultConf) {
		config.setModuleDefault(modName, defaultConf);
	}
};


// Export the modified configuration object.
module.exports = config;
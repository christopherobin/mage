var config = require('config');

// Alias setModuleDefaults to setTopLevelDefault.
config.setTopLevelDefault = config.setModuleDefaults;

// To avoid confusion, we delete the original reference.
delete config.setModuleDefaults;


/**
 * Define setModuleDefault so that it places additions under "modules" top level key.
 *
 * @param {String} modName  Name of module.
 * @param {Object} defaults An object with default parameters.
 */

config.setModuleDefault = function (modName, defaults) {
	var topDefault = {};
	topDefault[modName] = defaults;
	config.setTopLevelDefault('modules', topDefault);
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

// Export the modified configuration object.
module.exports = config;
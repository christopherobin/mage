var jsYaml = require('js-yaml');
var jsonlint = require('jsonlint');
var fs = require('fs');
var path = require('path');
var Matryoshka = require('./Matryoshka');

var cwd = process.cwd();
var configDir = path.join(cwd, 'config');
var supportedTypes = ['.yaml', '.json', '.js'];

var logger;

var configList = [];

var aggregate;

var isInitialized = false;

/**
 * Attempt to load a config file, and provide some helpful output if the file cannot be parsed.
 *
 * @param  {String} configPath A filesystem path to the configuration file.
 * @return {Object}            The loaded configuration object.
 */

function loadConfigFile(configPath) {
	logger.debug('Loading configuration file at:', configPath);

	var extension = path.extname(configPath);

	if (extension === '.yaml') {
		var options = {
			filename: configPath
		};

		return jsYaml.safeLoad(fs.readFileSync(configPath, 'utf8'), options);
	}

	if (extension === '.js') {
		return require(configPath);
	}

	if (extension === '.json') {
		try {
			return require(configPath);
		} catch (e) {
			try {
				jsonlint.parse(fs.readFileSync(configPath, 'utf8'));
			} catch (lintError) {
				if (typeof lintError.message === 'string') {
					lintError.message = lintError.message.replace(/\t/g, ' ');
				}

				throw lintError;
			}

			throw new Error('There was a problem loading a configuration file: ' + configPath);
		}
	}

	throw new Error('A configuration file was not of a supported type [.yaml, .json, .js]: ' + configPath);
}


/**
 * Given a file name without extension, attempt to load the file. The files are assumed to be in a
 * folder called 'config' that lives in the same directory that you booted your game in.
 *
 * @param  {String}  dir          An absolute path to the directory containing the config file.
 * @param  {String}  name         The file name (without extension).
 * @param  {Boolean} warn         Warn if configuration file was not found.
 * @param  {Boolean} defaultEmpty Set to true to return undefined rather than a fresh empty config.
 * @return {Object}               Contains "source" (the complete file path) and "config" keys.
 */

function loadConfig(dir, name, warn, defaultEmpty) {
	var extensionlessSource = path.join(dir, name);
	var rawSource;
	var rawConfig;

	for (var i = 0; i < supportedTypes.length && !rawConfig; i++) {
		rawSource = extensionlessSource + supportedTypes[i];

		if (fs.existsSync(rawSource)) {
			rawConfig = loadConfigFile(rawSource);
		}
	}

	if (!rawConfig) {
		if (warn) {
			logger.warning('No configuration content of name "' + name + '" was loaded from directory:', configDir);
		}

		if (!defaultEmpty) {
			return;
		}

		rawSource = module.filename;
		rawConfig = {};
	}

	return { source: rawSource, config: rawConfig };
}


/**
 * Perform the merge of all source Matryoshka and update the aggregate with it.
 *
 * @return {Matryoshka} The merged of the three source containers.
 */

function regenerate() {
	aggregate = Matryoshka.merge.apply(Matryoshka, configList);
}


function parseTrail(path) {
	// The empty string is a special case.
	if (path === '') {
		return [];
	}

	// Other strings can be split on dots into an array of path segments.
	if (typeof path === 'string') {
		return path.split('.');
	}

	// Arrays can just pass through.
	if (Array.isArray(path)) {
		return path;
	}

	// If we didn't return yet, then the path was wrong in some way.
	throw new TypeError('Configuration paths must be arrays or dot delimited strings.');
}


/**
 * Set a highest level key to contain some source object.
 *
 * @param {String} name       The key to assign the content to.
 * @param {String} sourcePath Absolute path to the configuration source file.
 */

exports.setTopLevelDefault = function (name, sourcePath) {
	var obj = {};
	obj[name] = loadConfigFile(sourcePath);

	var moduleConfig = configList[0];

	configList[0] = Matryoshka.merge(moduleConfig, new Matryoshka(obj, sourcePath));
	regenerate();
};


/**
 * Set a batch of top level defaults.
 *
 * @param {String} sourcePath An absolute path to the config file.
 */

exports.setDefaults = function (sourcePath) {
	var moduleConfig = configList[0];

	configList[0] = Matryoshka.merge(moduleConfig, new Matryoshka(loadConfigFile(sourcePath), sourcePath));
	regenerate();
};


/**
 * A helper class to resolve a configuration file and load it. The mod path should be the path to
 * the module folder. The config file is expected to be named config.<extension>.
 *
 * @param {String} modName The module name.
 * @param {String} modPath The absolute path to the module folder.
 */

exports.loadModuleConfig = function (modName, modPath) {
	var obj = { module: {} };
	var loaded = loadConfig(modPath, 'config');

	// An undefined loaded means that there was nothing to load, so just return here.
	if (!loaded) {
		return;
	}

	obj.module[modName] = loaded.config;

	var moduleConfig = configList[0];
	
	configList[0] = Matryoshka.merge(moduleConfig, new Matryoshka(obj, loaded.source));
	regenerate();
};


/**
 * Get a copy of the raw configuration from a given path.
 *
 * @param  {String[]|String} trail An array of keys, or a string with steps delimited by '.'.
 * @param  {*}               alt   If nothing is resolved, use alt.
 * @return {*}                     The resolved raw configuration object or alt.
 */

exports.get = function (trail, alt) {
	return aggregate.get(parseTrail(trail), alt);
};


/**
 * Get the source of a member of a configuration object.
 *
 * @param  {String[]|String}  trail An array of keys, or a string with steps delimited by '.'.
 * @return {String|Undefined}       The source path of the configuration member.
 */

exports.getSource = function (trail) {
	return aggregate.getSourceWithPath(parseTrail(trail));
};


/**
 * Get a copy of the underlying matryoshka object that stores the configuration aggregate.
 *
 * @param  {String[]|String}  trail An array of keys, or a string with steps delimited by '.'.
 * @return {Matryoshka}             A Matryoshka instance containing a copy of the aggregated configuration.
 */

exports.getMatryoshka = function (trail) {
	var matryoshka = aggregate;

	if (trail) {
		matryoshka = matryoshka.tunnel(parseTrail(trail));
	}

	return matryoshka ? matryoshka.copy() : undefined;
};


/**
 * For proper logging config needs access to the mage logger. We pass it in to this function, which
 * attempts to load configuration files.
 *
 * @param {Object} logObj A mage logger object. Config uses logObj.warn and logObj.info.
 */

exports.initialize = function (logObj) {
	if (isInitialized) {
		throw new Error('The config module has already been initialized.');
	}

	isInitialized = true;
	logger = logObj;

	var nodeEnv = process.env.NODE_ENV;

	if (!nodeEnv) {
		throw new Error('No value was set for the environment variable "NODE_ENV". This variable is needed for environment specific configuration.');
	}

	var defaultConf = loadConfig(configDir, 'default', true, true);

	var moduleConfig = new Matryoshka({}, module.filename);
	var defaultConfig = new Matryoshka(defaultConf.config, defaultConf.source);

	configList.push(moduleConfig);
	configList.push(defaultConfig);

	var devMode;

	if (process.env.DEVELOPMENT_MODE === 'true') {
		devMode = true;
	} else if (process.env.DEVELOPMENT_MODE === 'false') {
		devMode = false;
	}

	var envConfs = nodeEnv.split(',');

	for (var i = 0; i < envConfs.length; i += 1) {
		var userConf = loadConfig(configDir, envConfs[i], true, true);

		// The DEVELOPMENT_MODE environment variable can override things.

		if (devMode !== undefined) {
			userConf.config.developmentMode = devMode;
		}

		configList.push(new Matryoshka(userConf.config, userConf.source));
	}

	// The aggregate will contain the merge of all configs, and will be kept up to date.
	regenerate();

	// Make this chainable.
	return exports;
};
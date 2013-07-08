var jsYaml = require('js-yaml');
var jsonlint = require('jsonlint');
var fs = require('fs');
var path = require('path');
var Matryoshka = require('./Matryoshka');
var jsYaml = require('js-yaml');
var path = require('path');

var cwd = process.cwd();
var configDir = path.join(cwd, 'config');
var supportedTypes = ['.json', '.yaml', '.js'];

var logger;

var moduleConfig;
var defaultConfig;
var gameConfig;

var aggregate;

/**
 * Attempt to load a config file, and provide some helpful output if the file cannot be parsed.
 *
 * @param  {String} configPath A filesystem path to the configuration file.
 * @return {Object}            The loaded configuration object.
 */

function loadConfigFile(configPath) {
	var extention = path.extname(configPath);

	if (extention === '.json') {
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

	if (extention === '.js') {
		return require(module, configPath);
	}

	if (extention === '.yaml') {
		var content = fs.readFileSync(configPath, 'utf8');
		return jsYaml.safeLoad(content);
	}

	throw new Error('A configuration file was not of a supported type [.json, .yaml, .js]: ' + configPath);
}


/**
 * Given a file name without extention, attempt to load the file. The files are assumed to be in a
 * folder called 'config' that lives in the same directory that you booted your game in.
 *
 * @param  {String} name The module name.
 * @return {Object}      Contains "source" (the complete file path) and "config" keys.
 */

function loadConfig(dir, name, warn) {
	var extensionlessSource = path.join(dir, name);
	var rawSource;
	var rawConfig;

	for (var i = 0; i < supportedTypes.length && !rawConfig; i++) {
		rawSource = extensionlessSource + supportedTypes[i];

		if (fs.existsSync(rawSource)) {
			logger.info('Loading configuration file at:', rawSource);
			rawConfig = loadConfigFile(rawSource);
		}
	}

	if (!rawConfig && warn) {
		logger.warning('No configuration content for', name, 'was loaded from directory:', configDir);
		rawSource = module.filename;
		rawConfig = {};
	}

	return { source: rawSource, config: rawConfig };
}


/**
 * Perform the merge of the three source Matryoshka and update the aggregate with it.
 *
 * @return {Matryoshka} The merged of the three source containers.
 */

function regenerate() {
	aggregate = Matryoshka.merge(moduleConfig, defaultConfig, gameConfig);
}


/**
 * Set a highest level key to contain some source object.
 *
 * @param {String} name       The key to assign the content to.
 * @param {String} sourcePath Absolute path to the source file.
 */

exports.setTopLevelDefault = function (name, sourcePath) {
	var obj = {};
	obj[name] = loadConfigFile(sourcePath);

	moduleConfig = Matryoshka.merge(moduleConfig, new Matryoshka(obj, sourcePath));
	regenerate();
};


/**
 * Set a mage module level key to contain some source object.
 *
 * @param {String} modName    The name of the module to assign default configuation to.
 * @param {String} sourcePath Absolute path to the source file.
 */

exports.setModuleDefault = function (modName, sourcePath) {
	var obj = { module: {} };
	obj.module[modName] = loadConfigFile(sourcePath);

	moduleConfig = Matryoshka.merge(moduleConfig, new Matryoshka(obj.content, obj.source));
	regenerage();
};


/**
 * Set a batch of top level defaults.
 *
 * @param {String} sourcePath An absolute path the the config file.
 */

exports.setDefaults = function (sourcePath) {
	moduleConfig = Matryoshka.merge(moduleConfig, new Matryoshka(loadConfigFile(sourcePath), sourcePath));
	regenerate();
};


/**
 * A helper class to resolve a configuration file and load it.
 *
 * @param {String} modName The module name.
 * @param {String} modPath The path to the config file.
 */

exports.loadModuleConfig = function (modName, modPath) {
	var obj = loadConfig(modPath, 'config', false);
	moduleConfig = Matryoshka.merge(moduleConfig, new Matryoshka(obj.config, obj.source));
};


/**
 * Get a copy of the raw configuration from a given path.
 *
 * @param  {String[]|String} modPath An array of keys, or a string with steps delimited by '.'.
 * @param  {*}               alt     If nothing is resolved, use alt.
 * @return {*}                       The resolved raw configuration object or alt.
 */

exports.get = function (modPath, alt) {
	var path = Array.isArray(modPath) ? modPath : modPath.split('.');

	return aggregate.get(path, alt);
};


/**
 * Get the source of a member of a configuration object.
 *
 * @param  {String[]|String}  modPath An array of keys, or a string with steps delimited by '.'.
 * @return {String|Undefined}         The source path of the configuration member.
 */

exports.getSource = function (modPath) {
	var path = Array.isArray(modPath) ? modPath : modPath.split('.');

	return aggregate.getSourceWithPath(path);
};


/**
 * Get a copy of the underlying matryoshka object that stores the configuration aggregate.
 *
 * @return {Matryoshka} A Matryoshka instance containing a copy of the aggregated configuration.
 */

exports.getMatryoshka = function () {
	return aggregate.copy();
};


/**
 * For proper logging config needs access to the mage logger. We pass it in to this function, which
 * attempts to load configuration files.
 *
 * @param {Object} logObj A mage logger object. Config uses logObj.warn and logObj.info.
 */

exports.initialize = function (logObj) {
	logger = logObj;

	var defaultConf = loadConfig(configDir, 'default', true);
	var userConf = loadConfig(configDir, process.env.NODE_ENV, true);

	// The DEVELOPMENT_MODE environment variable can override things, so we need to insert it into the
	// user config before we wrap it.
	switch (process.env.DEVELOPMENT_MODE) {
	case 'true':
		userConf.config.developmentMode = true;
		break;
	case 'false':
		userConf.config.developmentMode = false;
		break;
	default:
		userConf.config.developmentMode = userConf.config.developmentMode === true;
	}

	// Wrap the source files, and make a dummy module configuration matryoshka.
	moduleConfig = new Matryoshka({}, module.filename);
	defaultConfig = new Matryoshka(defaultConf.config, defaultConf.source);
	gameConfig = new Matryoshka(userConf.config, userConf.source);

	// The aggregate will contain the merge of all three, and will be kept up to date.
	regenerate();

	// Make this chainable.
	return exports;
};

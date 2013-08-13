var async = require('async');
var pathBasename = require('path').basename;
var pathResolve = require('path').resolve;
var pathJoin = require('path').join;
var rl = require('../lib/readline.js');

var magePath = process.cwd();
var appPath = pathResolve(magePath, '../..');

var magePackage = require(pathJoin(magePath, 'package.json'));

var replacements = {};

function getVar(varName, required) {
	if (required && !replacements.hasOwnProperty(varName)) {
		throw new Error('Found unknown template variable: ' + varName);
	}

	var value = replacements[varName] || '';

	return '' + (typeof value === 'function' ? value() : value);
}

function ask(question, varName, re, cb) {
	rl.ask(question, getVar(varName), function (answer) {
		if (re && !answer.match(re)) {
			return ask(question, varName, re, cb);
		}

		replacements[varName] = answer;

		cb();
	});
}

replacements = {
	APP_NAME: pathBasename(appPath),
	APP_SHORTNAME: '',
	APP_PATH: appPath,
	APP_PATHNAME: pathBasename(appPath),
	APP_DESCRIPTION: '',
	APP_VERSION: '0.0.1',
	APP_AUTHOR: process.env.USER,
	APP_LICENSE: 'Private',
	APP_REPO: '',
	APP_CLIENTHOST_EXPOSE: 'http://localhost',
	APP_SAVVY_EXPOSE: 'http://localhost:81',
	APP_SERVICE_NAME: function () {
		return getVar('ENV_USER').substr(0, 2) + '-' + getVar('APP_SHORTNAME');
	},
	MAGE_VERSION: magePackage.version,
	MAGE_NODE_VERSION: (magePackage.engines && magePackage.engines.node) ? magePackage.engines.node : '',
	ENV_USER: process.env.USER
};

if (process.env.NODE_ENV) {
	replacements.ENV_NODE_ENV = process.env.NODE_ENV;
}


exports.prepare = function (cb) {
	// ask questions to fill the replacements map

	async.series([
		function (callback) {
			ask('Name your game:', 'APP_NAME', /^.{2,}/, callback);
		},
		function (callback) {
			ask('Provide a short name (2-5 characters):', 'APP_SHORTNAME', /^.{2,5}$/, callback);
		},
		function (callback) {
			ask('Describe your game:', 'APP_DESCRIPTION', null, callback);
		},
		function (callback) {
			ask('Name the author/company:', 'APP_AUTHOR', null, callback);
		},
		function (callback) {
			ask('Provide the base URL for your game:', 'APP_CLIENTHOST_EXPOSE', null, callback);
		},
		function (callback) {
			ask('Provide the base URL for the Savvy interface:', 'APP_SAVVY_EXPOSE', null, callback);
		},
		function (callback) {
			ask('Please provide a valid GitHub repository URL (if there is one):', 'APP_REPO', null, callback);
		}
	], cb);
};

exports.replace = function (varName) {
	return getVar(varName, true);
};

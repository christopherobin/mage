var async = require('async');
var pathBasename = require('path').basename;
var pathResolve = require('path').resolve;
var pathJoin = require('path').join;
var rl = require('../lib/readline.js');

var magePath = process.cwd();
var appPath = pathResolve(magePath, '../..');

var magePackage = require(pathJoin(magePath, 'package.json'));

var replacements = {
	APP_NAME: pathBasename(appPath),
	APP_DESCRIPTION: '',
	APP_VERSION: '0.0.1',
	APP_AUTHOR: process.env.USER || '',
	APP_LICENSE: 'Private',
	APP_REPO: '',
	APP_CLIENTHOST_EXPOSE: '',
	APP_SAVVY_EXPOSE: '',
	MAGE_VERSION: magePackage.version,
	MAGE_NODE_VERSION: (magePackage.engines && magePackage.engines.node) ? magePackage.engines.node : '',
	ENV_USER: process.env.USER || ''
};

if (process.env.NODE_ENV) {
	replacements.ENV_NODE_ENV = process.env.NODE_ENV;
}


exports.prepare = function (cb) {
	// ask questions to fill the replacements map

	function ask(question, varName, re, callback) {
		rl.ask(question, replacements[varName], function (answer) {
			if (re && !answer.match(re)) {
				return ask(question, varName, re, callback);
			}

			replacements[varName] = answer;
			callback();
		});
	}

	async.series([
		function (callback) {
			ask('Name your game:', 'APP_NAME', /^.{2,}/, callback);
		},
		function (callback) {
			ask('Provide a short name (max 8 characters):', 'APP_SHORTNAME', /^.{2,8}$/, callback);
		},
		function (callback) {
			ask('Describe your game:', 'APP_DESCRIPTION', null, callback);
		},
		function (callback) {
			ask('Name the author/company:', 'APP_AUTHOR', null, callback);
		},
		function (callback) {
			ask('Please provide a valid GitHub repository URL (if there is one):', 'APP_REPO', null, callback);
		}
	], cb);
};

exports.replace = function (varName) {
	if (!replacements.hasOwnProperty(varName)) {
		throw new Error('Found unknown template variable: ' + varName);
	}

	return replacements[varName];
};

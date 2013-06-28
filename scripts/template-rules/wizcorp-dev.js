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
	APP_AUTHOR: 'Wizcorp',
	APP_LICENSE: 'Private',
	APP_REPO: '',
	APP_CLIENTHOST_EXPOSE: 'http://' + pathBasename(appPath) + '.' + process.env.USER + '.node.wizcorp.jp',
	APP_SAVVY_EXPOSE: 'http://' + pathBasename(appPath) + '.' + process.env.USER + '.node.wizcorp.jp/savvy',
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
			ask('Provide a short name (2-8 characters):', 'APP_SHORTNAME', /^.{2,8}$/, callback);
		},
		function (callback) {
			ask('Describe your game:', 'APP_DESCRIPTION', null, callback);
		},
		function (callback) {
			rl.ask('Please provide a valid GitHub repository name (if there is one):', '', function (answer) {
				if (answer) {
					replacements.APP_REPO = 'git@github.com:Wizcorp/' + answer + '.git';
				}

				callback();
			});
		}
	], cb);
};

exports.replace = function (varName) {
	if (!replacements.hasOwnProperty(varName)) {
		throw new Error('Found unknown template variable: ' + varName);
	}

	return replacements[varName];
};

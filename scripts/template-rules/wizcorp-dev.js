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
	APP_PATH: appPath,
	APP_PATHNAME: pathBasename(appPath),
	APP_DESCRIPTION: '',
	APP_VERSION: '0.1.0',
	APP_AUTHOR: 'Wizcorp',
	APP_LICENSE: 'Private',
	APP_REPO: '',
	APP_CLIENTHOST_EXPOSE: 'http://' + pathBasename(appPath) + '.' + process.env.USER + '.node.wizcorp.jp',
	MAGE_REPO: 'git+ssh://git@github.com:Wizcorp/mage.git',
	MAGE_VERSION: magePackage.version,
	MAGE_NODE_VERSION: magePackage.engines && magePackage.engines.node,
	ENV_USER: process.env.USER
};


exports.prepare = function (cb) {
	// ask questions to fill the replacements map

	async.series([
		function (callback) {
			ask('Name your game:', 'APP_NAME', /^.{2,}/, callback);
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
	return getVar(varName, true);
};

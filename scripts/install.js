#!/usr/bin/env node

var bootstrapName = process.env.BOOTSTRAP;

if (!bootstrapName) {
	process.exit(0);
}

// remove the BOOTSTRAP environment variable to avoid it being visible in child processes.

delete process.env.BOOTSTRAP;


var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var mkdirpSync = require('mkdirp').sync;
var async = require('async');
var pretty = require('./lib/pretty.js');
var ask = require('./lib/readline.js').ask;
var EOL = require('os').EOL;

var magePath = process.cwd();
var appPath = path.resolve(magePath, '../..');

var magePackagePath = path.join(magePath, 'package.json');
var appPackagePath = path.join(appPath, 'package.json');

var templateRulesPath = path.join(magePath, 'scripts/template-rules/' + bootstrapName + '.js');
var templateRulesName = fs.existsSync(templateRulesPath) ? bootstrapName : 'default';

var templateRules = require('./template-rules/' + templateRulesName + '.js');


pretty.h1('Setting up application');

pretty.info('Parsing MAGE package.json');

var magePackage = require(magePackagePath);


function find(startPath) {
	pretty.info('Scanning: ' + startPath);

	var result = {
		folders: [],
		files: []
	};

	function scan(absPath, relPath) {
		var files = fs.readdirSync(absPath);

		for (var i = 0; i < files.length; i++) {
			var fileName = files[i];
			var foundAbsPath = path.join(absPath, fileName);
			var foundRelPath = path.join(relPath, fileName);

			var stats = fs.statSync(foundAbsPath);

			if (stats.isDirectory()) {
				result.folders.push(foundRelPath);
				scan(foundAbsPath, foundRelPath);
			} else if (stats.isFile()) {
				result.files.push(foundRelPath);
			}
		}
	}

	scan(startPath, '');

	return result;
}


function exec(cmd, args, cwd, cb) {
	var proc = spawn(cmd, args || [], { cwd: cwd || appPath, stdio: 'inherit' });

	var data = '';

	proc.on('data', function (buff) {
		data += buff.toString();
	});

	proc.on('close', function (code) {
		if (code !== 0) {
			pretty.warning(cmd + ' failed with code: ' + code);
			return cb(true);
		}

		cb(null, data);
	});

}

if (fs.existsSync(appPackagePath)) {
	// bootstrapping with an already existing package.json file?

	pretty.warning('Cannot bootstrap an application if a package.json file is already in place.');
	process.exit(1);
}


/**
 * Creates the application skeleton
 *
 * @param {Function} cb
 */

function bootstrap(cb) {
	/**
	 * Copies a file from "from" to "to", and replaces template vars in filenames and file content.
	 * @param {String} from  from-path
	 * @param {String} to    to-path
	 */

	function copy(from, to) {
		var mode = fs.statSync(from).mode;
		var src = fs.readFileSync(from, 'utf8');

		var re = /%([0-9A-Z\_]+)%/g;

		function replacer(_, match) {
			// We support the %PERIOD% variable to allow .gitignore to be created. The reason:
			// npm "kindly" ignores .gitignore files, so we have to use this workaround.
			// More info: https://github.com/isaacs/npm/issues/2958

			if (match === 'PERIOD') {
				return '.';
			}

			return templateRules.replace(match);
		}

		try {
			to = to.replace(re, replacer);
			src = src.replace(re, replacer);
		} catch (error) {
			pretty.warning(error + ' in: ' + from);

			// skip this file
			return;
		}

		var fd = fs.openSync(to, 'w', mode);
		fs.writeSync(fd, src);
		fs.closeSync(fd);
	}

	async.series([
		function (callback) {
			// prompt for information that the template engine needs
			templateRules.prepare(callback);
		},
		function (callback) {
			function tpl(filePath) {
				copy(path.join(magePath, 'scripts/templates/create-project', filePath), path.join(appPath, filePath));
			}

			function mkdir(folderPath) {
				mkdirpSync(path.join(appPath, folderPath));
			}

			var found = find(path.join(magePath, 'scripts/templates/create-project'));

			found.folders.forEach(mkdir);
			found.files.forEach(tpl);

			callback();
		},
		function (callback) {
			pretty.h2('Git repository');

			ask('Would you like me to set up Git for this game?', 'yes', function (answer) {
				if (answer.toLowerCase() !== 'yes') {
					return callback();
				}

				pretty.h2('Setting up git');

				var appRepoUrl = templateRules.replace('APP_REPO');

				async.series([
					// exec(cmd, args, cwd, cb)

					function (callback) {
						pretty.info('git init');

						exec('git', ['init'], null, callback);
					},
					function (callback) {
						if (!appRepoUrl) {
							return callback();
						}

						pretty.info('Adding your GitHub URL as remote "origin" (git remote add origin "' + appRepoUrl + '")');

						exec('git', ['remote', 'add', 'origin', appRepoUrl], null, callback);
					},
					function (callback) {
						pretty.info('Staging files for first commit (git add .)');

						exec('git', ['add', '.'], null, callback);
					},
					function (callback) {
						pretty.info('First commit (git commit)');

						var message = 'Automated first commit (by MAGE installer).';

						exec('git', ['commit', '-m', message], null, callback);
					},
					function (callback) {
						pretty.info('Creating a "develop" branch (git checkout -b develop)');

						exec('git', ['checkout', '-b', 'develop'], null, callback);
					},
					function (callback) {
						if (!appRepoUrl) {
							return callback();
						}

						ask('Would you like me to push the first commit to GitHub?', 'yes', function (answer) {
							if (answer.toLowerCase() !== 'yes') {
								return callback();
							}

							pretty.info('Pushing to remote "origin" (git push origin develop master)');

							exec('git', ['push', 'origin', 'develop', 'master'], null, callback);
						});
					},
					function (callback) {
						ask('Would you like me to set up git hooks?', 'yes', function (answer) {
							if (answer.toLowerCase() !== 'yes') {
								return callback();
							}

							pretty.info('Setting up git hooks (make dev-githooks)');

							exec('make', ['dev-githooks'], null, callback);
						});
					}
				], callback);
			});
		},
		function (callback) {
			// npm install other dependencies for this game

			pretty.h2('Installing dependencies and making builds (make all)');

			exec('make', ['all'], null, callback);
		},
		function (callback) {
			var baseUrl = templateRules.replace('APP_CLIENTHOST_EXPOSE');

			var msg = [
				'All done! You can now start your game in the foreground by running "./game",',
				'or see startup options by running "./game --help".',
				'',
				'We also installed a Makefile for you. You can use that to do a few more operations.',
				'Please run "make" once for a full explanation of what you can do with it.',
				'',
				'Once your application is running, you can open the game at: ' + baseUrl + '/app/game'
			];

			pretty.chromify(msg.join(EOL), '❖', ['magenta', 'bold'], 'yellow');
			callback();
		}
	], cb);
}

// start

pretty.h2('Bootstrapping MAGE v' + magePackage.version + ' application.');

bootstrap(function (error) {
	process.exit(error ? 1 : 0);
});

var mage = require('../mage');

var program = require('commander');


// software versions

var versions = [
	mage.rootPackage.name + ': v' + mage.rootPackage.version,
	'MAGE: v' + mage.version,
	''
];

Object.keys(process.versions).forEach(function (key) {
	versions.push(key + ': v' + process.versions[key]);
});

program.version(versions.join('\n'));


// options

program.optionFor('--version').description = 'output version numbers';
program.option('-v, --verbose', 'let the terminal logger log all channels');
program.option('--stack-limit <limit>', 'change the stack trace limit', parseInt);


// tasks

program
	.command('install-components')
	.description('install all components used in apps and dashboards into ./components')
	.action(function () {
		mage.setTask('install-components');
	});

program
	.command('build')
	.description('builds all apps into ./build')
	.option('-f, --force', 'builds apps even in development mode')
	.option('--clean', 'removes all existing builds')
	.action(function (options) {
		if (options.clean) {
			mage.setTask('build-clean');
		} else {
			mage.setTask('build', { force: options.force });
		}
	});

program
	.command('create-phantom <app>')
	.description('output a PhantomJS client for the given app')
	.action(function (app) {
		mage.setTask('create-phantom', { app: app });
	});

program
	.command('show-config [trail]')
	.description('output the full configuration, or the sub-config at the given trail in JSON')
	.option('--origins', 'outputs the origins of each entry')
	.action(function (trail, options) {
		mage.setTask('show-config', { trail: trail, origins: options.origins });
	});

program
	.command('archivist-create')
	.description('create database environments for all configured vaults')
	.action(function () {
		mage.setTask('archivist-create');
	});

program
	.command('archivist-drop')
	.description('destroy database environments for all configured vaults (use with caution!)')
	.action(function () {
		mage.setTask('archivist-drop');
	});

program
	.command('archivist-migrate [version]')
	.description('migrates all vaults to the current version, or to the version requested')
	.action(function (version) {
		mage.setTask('archivist-migrate', { version: version });
	});

// daemonizer

program
	.command('start')
	.description('start the application daemonized')
	.action(function () {
		mage.setTask('daemonize', { command: 'start' });
	});

program
	.command('stop')
	.description('stop the daemonized application')
	.action(function () {
		mage.setTask('daemonize', { command: 'stop' });
	});

program
	.command('restart')
	.description('restart the daemonized application')
	.action(function () {
		mage.setTask('daemonize', { command: 'restart' });
	});

program
	.command('reload')
	.description('recycle all workers with zero-downtime (not to be used on version changes)')
	.action(function () {
		mage.setTask('daemonize', { command: 'reload' });
	});

program
	.command('status')
	.description('output the status of the daemonized application')
	.action(function () {
		mage.setTask('daemonize', { command: 'status' });
	});


exports.run = function () {
	program.on('*', function (args) {
		console.error('unrecognized command:', args[0]);

		program.outputHelp();
		process.exit(1);
	});

	// We only want to parse command line options when we are run from the game
	// directory. We check for a correctly parsed package.json because mage
	// does not currently load the package file properly when not run from the
	// game directory. If this gets fixed in the future, this check will also
	// need to change.

	var hasParsedPackage = mage.rootPackage.package && mage.rootPackage.package.dependencies && mage.rootPackage.package.dependencies.hasOwnProperty('mage');

	if (hasParsedPackage) {
		program.parse(process.argv);
	}

	if (program.verbose) {
		mage.core.loggingService.enableVerboseTerminal();
	}

	if (program.stackLimit !== undefined) {
		Error.stackTraceLimit = program.stackLimit;
	}
};


// for extension:

exports.program = program;

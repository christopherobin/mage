var mage = require('../mage');

var program = require('commander');


// options

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
	.option('--clean', 'removes all existing builds')
	.action(function (options) {
		if (options.clean) {
			mage.setTask('build-clean');
		} else {
			mage.setTask('build');
		}
	});

program
	.command('assets-index')
	.description('index assets for all apps')
	.action(function () {
		mage.setTask('assets-index');
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
	.command('archivist-create [vaults]')
	.description('create database environments for all configured vaults')
	.action(function (vaults) {
		mage.setTask('archivist-create', { vaults: vaults });
	});

program
	.command('archivist-drop [vaults]')
	.description('destroy database environments for all configured vaults (use with caution!)')
	.action(function (vaults) {
		mage.setTask('archivist-drop', { vaults: vaults });
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

program
	.option('--version', 'output version numbers', function () {
		mage.setTask('show-versions');
	});


exports.run = function () {
	// Don't run mage, if where are running unit tests
	if (process.mainModule.filename.indexOf('_mocha') !== -1) {
		return;
	}

	program.on('*', function (args) {
		console.error('unrecognized command:', args[0]);

		program.outputHelp();
		process.exit(1);
	});

	program.parse(process.argv);

	if (program.verbose) {
		mage.core.loggingService.enableVerboseTerminal();
	}

	if (program.stackLimit !== undefined) {
		Error.stackTraceLimit = program.stackLimit;
	}
};


// for extension:

exports.program = program;
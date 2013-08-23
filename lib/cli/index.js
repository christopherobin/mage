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


// tasks

program
	.command('install-components')
	.description('install all components used in apps and dashboards into ./components')
	.action(function () {
		mage.setTask(require('../tasks/install-components'));
	});

program
	.command('create-phantom <app>')
	.description('output a PhantomJS client for the given app')
	.action(function (app) {
		mage.setTask(require('../tasks/create-phantom').bind(null, app));
	});

program
	.command('show-config [trail]')
	.description('output the full configuration, or the sub-config at the given trail in JSON')
	.action(function (trail) {
		mage.setTask(require('../tasks/show-config').bind(null, trail));
	});

program
	.command('archivist-create')
	.description('create database environments for all configured vaults')
	.action(function () {
		mage.setTask(require('../tasks/archivist-create'));
	});

program
	.command('archivist-drop')
	.description('destroy database environments for all configured vaults (use with caution!)')
	.action(function () {
		mage.setTask(require('../tasks/archivist-drop'));
	});

program
	.command('archivist-migrate [version]')
	.description('migrates all vaults to the current version, or to the version requested')
	.action(function (version) {
		mage.setTask(require('../tasks/archivist-migrate').bind(null, version));
	});

// daemonizer

exports.enableDaemon = function (daemon) {
	program
		.command('start')
		.description('start the application daemonized')
		.action(function () {
			daemon.start();
		});

	program
		.command('stop')
		.description('stop the daemonized application')
		.action(function () {
			daemon.stop();
		});

	program
		.command('restart')
		.description('restart the daemonized application')
		.action(function () {
			daemon.restart();
		});

	program
		.command('reload')
		.description('recycle all workers with zero-downtime (not to be used on version changes)')
		.action(function () {
			daemon.reload();
		});

	program
		.command('status')
		.description('output the status of the daemonized application')
		.action(function () {
			daemon.status();
		});
};


exports.run = function () {
	program.on('*', function (args) {
		console.error('unrecognized command:', args[0]);

		program.help();
	});

	program.parse(process.argv);

	if (program.verbose) {
		mage.core.loggingService.enableVerboseTerminal();
	}
};


// for extension:

exports.program = program;

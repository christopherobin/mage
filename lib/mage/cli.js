var mage = require('./index.js');

var program = require('commander');

program.version(mage.version);


program
	.command('install-components')
	.description('Install all components used in apps and dashboards into ./components.')
	.action(function () {
		mage.setTask(require('./tasks/install-components'));
	});

exports.enableDaemon = function (daemon) {
	program
		.command('start')
		.description('Start the application daemonized.')
		.action(function () {
			daemon.start();
		});

	program
		.command('stop')
		.description('Stop the daemonized application.')
		.action(function () {
			daemon.stop();
		});

	program
		.command('restart')
		.description('Restart the daemonized application.')
		.action(function () {
			daemon.restart();
		});

	program
		.command('reload')
		.description('Recycle all workers with zero-downtime (not to be used on version changes).')
		.action(function () {
			daemon.reload();
		});

	program
		.command('status')
		.description('Output the status of the daemonized application.')
		.action(function () {
			daemon.status();
		});
};


exports.run = function () {
	program.on('*', function (args) {
		console.log('Unrecognized command:', args[0]);

		program.help();
	});

	program.parse(process.argv);
};


// for extension:

exports.program = program;

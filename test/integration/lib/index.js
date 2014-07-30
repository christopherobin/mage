var mage = require('mage');

var mageModules = [
	'archivist',
	'dashboard',
	'ident',
	'session',
	'time'
];

mage.useModules(mageModules);

mage.addModulesPath('./lib/modules');

var projectModules = [
	'test',
	'user'
];

mage.useModules(projectModules);


exports.mage = mage;
exports.autorun = false;
exports.appNames = [];


function createTest(app) {
	var testPage = app.addIndexPage('loader', './www/test/');
	testPage.registerComponent('mypackage', './www/test/mypackage', { assetMap: true });
	testPage.routes.push('/test');
	testPage.routes.push('/');
}

function mageSetup(cb) {
	mage.setup(function (error, apps) {
		if (error) {
			return cb(error);
		}

		exports.appNames = Object.keys(apps);

		createTest(apps.test);

		cb();
	});
}

function mageStart(cb) {
	mage.start(cb);
}

// We can setup the project with this.

exports.setup = function (cb) {
	mage.cli.program
		.command('autorun')
		.description('Will autorun the CI tests once (instead of hosting them)')
		.action(function () {
			exports.autorun = true;
		});

	mage.cli.run();

	mageSetup(cb);
};

// We can start the project with this.

exports.start = function (cb) {
	mageStart(cb);
};

// We can quit the project with this.

exports.quit = function (exitCode) {
	mage.quit(exitCode);
};

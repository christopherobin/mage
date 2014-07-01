var mage = require('mage');

var mageModules = [
	'archivist',
	'ident',
	'session',
	'time'
];

mage.useModules(mageModules);

mage.addModulesPath('./lib/modules');

var projectModules = [
	'user'
];

mage.useModules(projectModules);

function createTest(app) {
	var testPage = app.addIndexPage('loader', './www/test/');
	testPage.routes.push('/test');
}

function mageSetup(cb) {
	mage.setup(function (error, apps) {
		if (error) {
			return cb(error);
		}

		createTest(apps.test);

		cb();
	});
}

function mageStart(cb) {
	mage.start(cb);
}

exports.mage = mage;

// We can setup the project with this.

exports.setup = function (cb) {
	if (mage.cli) { // Backward compatibility
		mage.cli.run();
	}
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

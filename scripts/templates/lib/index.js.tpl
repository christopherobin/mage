var mage = require('mage');
var logger = mage.core.logger;


mage.addModulesPath('./lib/modules');
mage.useModules(
	'time',
	'archivist',
	'session',
	'assets',
	'pauser',
	'logger',
	'dashboard'
);

mage.useModules(
	'settings',
	'formulas',
	'player',
	'auth',
	'cards',
	'roster',
	'scout',
	'boss',
	'manager',
	'pvp',
	'admin',
	'teams',
	'gacha'
);

// base paths

var paths = {
	www: './www',
	assets: './assets'
};

var app;



function enforceVersion(cb) {
	var version = 1;

	logger.info('Enforcing minimum build version', version);

	// set the backend code version, which will kick players out if their client expects a different version

	mage.session.setCurrentVersion(version, { EN: 'We added some cool features, please restart and find out!' });

	return cb();
}


function createGame(cb) {
	logger.info('Creating the game app');

	// creating the game app

	app = mage.core.app.get('game'); //new mage.core.app.web.WebApp('game', { languages: ['en'], densities: [1], screens: [[1, 1]] });

	// critical assets: these are the files required to be able to display the landing page
	// they are: fonts, main.mp3, landing page UI images

	app.assetMap.setup({
		cacheability: {
			img: ['.', 0],
			font: ['.', 1],
			webview: ['.', 1]
		},
		profiles: {}
	});

	app.assetMap.addFolder(paths.assets);


	// create loader page

	var loaderPage = app.addIndexPage('loader', paths.www + '/pages/gameLoader');
	app.addIndexPage('footerPage', paths.www + '/pages/footerPage', { route: 'webview/footerPage.html' }, { context: 'webview', descriptor: 'footerPage' });
	app.addIndexPage('headerPage', paths.www + '/pages/headerPage', { route: 'webview/headerPage.html' }, { context: 'webview', descriptor: 'headerPage' });
	app.addIndexPage('menuPage', paths.www + '/pages/menuPage', { route: 'webview/menuPage.html' }, { context: 'webview', descriptor: 'menuPage' });


	// mage pages for the game

	loaderPage.registerComponent('landing', paths.www + '/pages/landing', { assetMap: true });
	loaderPage.registerComponent('main', paths.www + '/pages/main');


	return cb();
}


function setupPageProcessors(cb) {
	logger.info('Setting up page parsers and post processors');

	require('./parsers');
	require('./postprocessors');
	return cb();
}


function startGame(cb) {
	logger.info('Starting the game');

	mage.start();
	return cb();
}

mage.setup(function () {

	async.series([
		enforceVersion,
		createGame,
		setupPageProcessors,
		startGame
	], function (error) {
		if (error) {
			mage.fatalError(error);
		}
	});
});

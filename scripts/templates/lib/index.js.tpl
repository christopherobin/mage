var mage = require('mage');
var logger = mage.core.logger.context('game-boot');


mage.addModulesPath('./lib/modules');
mage.useModules(
	'archivist',
	'assets',
	'dashboard',
	'logger',
	'session',
	'time'
);

// base paths

var paths = {
	www: './www',
	assets: './assets'
};


function createGame(app) {
	logger.info('Creating the game app');

	// creating the game app

	app.assetMap.setup({
		cacheability: {
			img: ['.', 0],
		},
		profiles: {}
	});

	app.assetMap.addFolder(paths.assets);

	// create loader page

	var loaderPage = app.addIndexPage('loader', paths.www + '/pages/gameLoader');

	// mage pages for the game

	loaderPage.registerComponent('landing', paths.www + '/pages/landing', { assetMap: true });
	loaderPage.registerComponent('main', paths.www + '/pages/main');

	// start mage

	mage.start();
}


mage.setup(function (apps) {
	createGame(apps.game);
});

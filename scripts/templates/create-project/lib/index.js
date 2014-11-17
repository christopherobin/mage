var mage = require('mage');
var logger = mage.core.logger.context('game-boot');


mage.cli.run();

mage.addModulesPath('./lib/modules');
mage.useModules(
	'archivist',
	'assets',
	'dashboard',
	'logger',
	'session',
	'time'
);


function createGame(app) {
	logger.info('Creating the game app');

	// creating the game app

	app.assetMap.setup({
		cacheability: {
			img: ['.', 0]
		},
		profiles: {}
	});

	app.assetMap.addFolder('./assets');

	// create loader page

	var loaderPage = app.addIndexPage('loader', './www/pages/gameLoader');

	// mage pages for the game

	loaderPage.registerComponent('landing', './www/pages/landing', { assetMap: true });
	loaderPage.registerComponent('main', './www/pages/main');

	// pushing '/' on routes makes it so that you don't have to go to /app/game
	loaderPage.routes.push('/');

	// start mage

	mage.start();
}


mage.setup(function (error, apps) {
	if (error) {
		process.exit(1);
	} else {
		createGame(apps.game);
	}
});

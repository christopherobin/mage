$html5client('io');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.archivist');
$html5client('module.session');
$html5client('module.gm');

(function () {
	var mage = window.mage;

	mage.configure({});

	mage.loader.once('login.loaded', function () {
		mage.setupModules(['assets'], function () {
			mage.loader.displayPage('login');
		});
	});

	// mage.gm.getTools(function (error, toolsList) {
}());

$html5client('core');
$html5client('loader');

(function (loader) {

	var pages = ['login'];

	loader.setup(pages);

	loader.on('error', function () {
		alert('Fatal error');
	});

	loader.on('offline', function () {
		console.warn('offline');
	});

	loader.on('online', function () {
		console.warn('online');
	});

	loader.start();

}(window.mage.loader));

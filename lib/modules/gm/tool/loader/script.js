$html5client('core');
$html5client('loader');

(function (loader) {

	loader.on('error', function () {
		alert('Fatal error');
	});

	loader.on('offline', function () {
		console.warn('offline');
	});

	loader.on('online', function () {
		console.warn('online');
	});

	loader.loadPage('login');

}(window.mage.loader));

var mageLoader = require('loader');

mageLoader.on('error', function (error) {
	console.error('Fatal error:', error);
});

mageLoader.on('warning', function (error) {
	console.warn('Warning:', error);
});

mageLoader.on('maintenance', function (error) {
	console.warn('Maintenance:', error);
});

mageLoader.on('offline', function (error) {
	console.warn('Offline:', error);
});

mageLoader.on('online', function () {
	console.log('Online');
});


mageLoader.loadPackage('login', function () {
	window.require('login');
});

var mageLoader = require('loader');
mageLoader.configure(window.mageConfig);


mageLoader.on('error', function () {
	window.alert('Fatal error');
});

mageLoader.on('offline', function () {
	console.warn('offline');
});

mageLoader.on('online', function () {
	console.warn('online');
});


mageLoader.once('login.loaded', function () {
	window.require('login');
});

mageLoader.loadPage('login');

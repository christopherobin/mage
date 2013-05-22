var mageLoader = require('loader');
mageLoader.configure(window.mageConfig);


require('pgCore');


mageLoader.on('error', function () {
	alert('Fatal error');
});

mageLoader.on('offline', function () {
	console.warn('offline');
});

mageLoader.on('online', function () {
	console.warn('online');
});


mageLoader.once('login.loaded', function () {
	require('login');
});

mageLoader.loadPage('login');
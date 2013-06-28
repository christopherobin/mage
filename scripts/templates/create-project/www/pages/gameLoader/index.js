// Import the MAGE loader library.

var loader = require('loader');


// Provide MAGE configuration to the loader.

loader.configure(window.mageConfig);


// Commence downloading and execution of the "landing" page.

loader.once('landing.loaded', function () {
	// Once the landing page becomes available, we should run its code by calling require() on it.

	require('landing');
});

window.setTimeout(function () {
	// Download the landing page

	loader.loadPage('landing');
}, 0);


// Handle the various states that the loader can be in.

loader.on('maintenance', function (msg, mimetype) {
	// The server is reporting that we are undergoing maintenance.
	// The loader will keep on trying in the background and once the maintenance status disappears,
	// the bootup process will continue automatically.

	// msg: the content of the response
	// mimetype: the content-type header of msg

	// small hack: assign mimetype to itself so JSLint won't complain

	mimetype = mimetype;

	if (!msg) {
		msg = 'We are currently undergoing maintenance, please try again soon. We thank you for your patience.';
	}

	window.alert(msg);
});

loader.on('online', function () {
	// Connecting...
});

loader.on('offline', function () {
	// Are we online? We may want to explain to the user that we need a working internet connection.
});

loader.on('error', function () {
	// There was a critical error. This should never happen, but if it does, the safest thing to do
	// is to start over.
});

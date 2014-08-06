// Import the MAGE loader library.

var loader = require('loader');


// Commence downloading and execution of the "landing" package.

loader.loadPackage('landing', function () {
	// Once the landing package becomes available, we can run its JavaScript code by calling
	// window.require() on it.

	window.require('landing');
});


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
	// In the mean time, the loader will auto-retry downloading the package.
});

loader.on('warning', function (warning) {
	// There was a warning. The system will remain functioning, but you should take note of this.
	console.error(warning);
});

loader.on('error', function (error) {
	// There was a critical error. This should never happen, but if it does, the safest thing to do
	// is to start over.
	console.error(error);
});

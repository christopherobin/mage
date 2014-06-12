var page = require('webpage').create();


// timeout the tests

var PHANTOM_TIMEOUT = 10 * 1000;

var testTimeout = setTimeout(function () {
	console.error('Timed out.');
	phantom.exit(1);
}, PHANTOM_TIMEOUT);

function exit(code) {
	clearTimeout(testTimeout);
	phantom.exit(code);
}

page.open('file:///' + phantom.libraryPath + '/index.html', function (status) {
	if (status !== 'success') {
		console.error('Load error: ' + status);
		exit(1);
	}
});

page.onConsoleMessage = function (msg) {
	var m = msg.match(/^__COMM__:(.+)$/);
	if (!m) {
		return;
	}

	var data;

	try {
		data = JSON.parse(m[1]);
	} catch (error) {
		console.error('JSON parse error on: ' + m[1]);
		return exit(2);
	}

	if (data.hasOwnProperty('msg')) {
		console.log(data.msg);
	}

	if (data.hasOwnProperty('exit')) {
		return exit(data.exit);
	}
};

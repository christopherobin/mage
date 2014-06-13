var webpage = require('webpage');

var testTimeout;

function exit(code) {
	clearTimeout(testTimeout);
	phantom.exit(code);
}


// timeout the tests

var PHANTOM_TIMEOUT = 10 * 1000;

testTimeout = setTimeout(function () {
	console.error('Tests timed out after ' + (PHANTOM_TIMEOUT / 1000) + ' sec.');
	phantom.exit(1);
}, PHANTOM_TIMEOUT);



var page = webpage.create();

page.open('file:///' + phantom.libraryPath + '/index.html', function (status) {
	if (status !== 'success') {
		console.error('Load error: ' + status);
		exit(1);
	}
});


// Communication from the page

page.onConsoleMessage = function (msg) {
	var m = msg.match(/^__PHANTOM__:(.+)$/);
	if (!m) {
		// suppress console messages, unless they were targeted at PhantomJS
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

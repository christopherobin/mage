var system = require('system');
var url = system.args[1];

// timeout the tests

var testTimeout;

function exit(code) {
	clearTimeout(testTimeout);
	if (code) {
		console.error(code);
	}

	var exitCode = code ? 1 : 0;
	phantom.exit(exitCode);
}

var PHANTOM_TIMEOUT = 10 * 1000;

testTimeout = setTimeout(function () {
	exit('Tests timed out after ' + (PHANTOM_TIMEOUT / 1000) + ' sec.');
}, PHANTOM_TIMEOUT);


// Communication from the page

function test(url, cb) {
	var page = require('webpage').create();

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
			return cb('JSON parse error on: ' + m[1]);
		}

		if (data.hasOwnProperty('msg')) {
			console.log(data.msg);
		}

		if (data.hasOwnProperty('exit')) {
			return cb(data.exit);
		}
	};

	// After we open the page, we expect the callback to be called through the
	// phantomMsg channel.

	page.open(url, function (status) {
		if (status !== 'success') {
			return cb('page.open: ' + status);
		}
	});
}

test(url, exit);

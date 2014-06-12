var page = require('webpage').create();

var PHANTOM_TIMEOUT = 60000;

var testTimeout = setTimeout(function () {
	console.error('Timed out.');
	phantom.exit(1);
}, PHANTOM_TIMEOUT);

function exit(code) {
	clearTimeout(testTimeout);
	phantom.exit(code);
}

page.open('file:///home/vagrant/ankamacomics/node_modules/mage/test/browser/index.html', function (status) {
	if (status !== 'success') {
		exit('Load error: ' + status);
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

// Communication with Phantom.js

function comm(obj) {
	console.log('__COMM__:' + JSON.stringify(obj));
}


// Set up Mocha

require('mocha');

window.mocha.setup('bdd');


// Load all tests

describe('MAGE Browser Unit Tests', function () {
	require('test-loader');
});


// Run tests

var runner = window.mocha.run(function () {
	if (runner.failures) {
		comm({ exit: 1, msg: runner.failures + ' test(s) failed.' });
	} else {
		comm({ exit: 0, msg: 'All tests passed.' });
	}
});

var indent = '';

runner.on('suite', function (suite) {
	comm({ msg: indent + '* ' + suite.title });
	indent += '  ';
});

runner.on('suite end', function () {
	if (indent.length > 0) {
		indent = indent.substr(0, indent.length - 2);
	}
});

runner.on('pass', function (test) {
	comm({ msg: indent + '- (passed) ' + test.title });
});

runner.on('fail', function (test) {
	comm({ msg: indent + '- (failed) ' + test.title + '\n' + indent + '  Error: ' + test.err });
});

// Test directory

var tests = [
	'test-eventManager',
	'test-loader'
];


module.exports = function (phantomMsg) {
	// Set up Mocha

	var elm = document.createElement('div');
	elm.id = 'mocha';
	document.body.appendChild(elm);

	require('mocha');

	var mocha = window.mocha;

	mocha.setup('bdd');

	// Run all tests

	describe('MAGE Browser Unit Tests', function () {
		tests.forEach(require);
	});

	// Create and return the test runner

	var runner = mocha.run();

	var indent = '';

	runner.on('suite', function (suite) {
		phantomMsg({ msg: indent + '* ' + suite.title });
		indent += '  ';
	});

	runner.on('suite end', function () {
		if (indent.length > 0) {
			indent = indent.substr(0, indent.length - 2);
		}
	});

	runner.on('pass', function (test) {
		phantomMsg({ msg: indent + '- (passed) ' + test.title });
	});

	runner.on('fail', function (test) {
		phantomMsg({ msg: indent + '- (failed) ' + test.title + '\n' + indent + '  Error: ' + test.err });
	});

	runner.on('end', function () {
		if (runner.failures) {
			phantomMsg({ exit: 1, msg: runner.failures + ' test(s) failed.' });
		} else {
			phantomMsg({ exit: 0, msg: 'All tests passed.' });
		}
	});
};

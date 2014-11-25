require('mocha');

// For some reason we can't require and assign it to the window at the same time.
var mocha = window.mocha;
mocha.setup('bdd');

function phantomMsg(obj) {
	if (window.hasOwnProperty('_phantom')) {
		console.log('__PHANTOM__:' + JSON.stringify(obj));
	} else {
		console.log(obj);
	}
}

function phantomRunner(error) {
	if (error) {
		return phantomMsg({ exit: 1, msg: 'Could not start tests', error: error });
	}

	var indent = '';
	var runner = mocha.run();

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
}

// Our tests live in /test/tests/browser
var browserTests = require('browser');

browserTests(phantomRunner);

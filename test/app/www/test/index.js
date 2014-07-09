var assert = require('assert');

// Mocha needs a div with id="mocha"
var elm = document.createElement('div');
elm.id = 'mocha';
document.body.appendChild(elm);

require('mocha');

var mocha = window.mocha;
mocha.setup('bdd');

function phantomMsg(obj) {
	if (window.hasOwnProperty('_phantom')) {
		console.log('__PHANTOM__:' + JSON.stringify(obj));
	}
}

function runTests() {
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

// Start MAGE section

var mage;

try {
	mage = window.mage = require('mage');
} catch (e) {
	phantomMsg({ exit: 1, msg: 'require MAGE failed: ' + e });
}

mage.useModules(require,
	'archivist',
	'ident',
	'session',
	'time',

	'user'
);

window.describe('MAGE Integration Tests', function () {
	it('MAGE says, "Hello."', function () {
		assert('Hello.');
	});

	require('testEventManager');
	require('testLoader');
	require('./tests/archivist');
	require('./tests/ident');
	require('./tests/session');
});

mage.httpServer.cmdMode = 'free';

mage.setup(function (error) {
	if (error) {
		return phantomMsg({ exit: 1, msg: 'MAGE.setup failed: ' + error });
	}

	runTests();
});

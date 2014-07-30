// Mocha needs a div with id="mocha"
var elm = document.createElement('div');
elm.id = 'mocha';
document.body.appendChild(elm);

window.assert = require('assert');

require('mocha');

var mocha = window.mocha;
mocha.setup('bdd');

function phantomRunner() {
	function phantomMsg(obj) {
		if (window.hasOwnProperty('_phantom')) {
			console.log('__PHANTOM__:' + JSON.stringify(obj));
		}
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


// load and run the browser tests

describe('MAGE Integration Tests', function () {
	it('Runs the browser test suite', require('browser'));
});

phantomRunner();

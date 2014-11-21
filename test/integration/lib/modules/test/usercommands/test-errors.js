var assert = require('assert');

exports.access = 'anonymous';

exports.params = ['testType'];

exports.execute = function (state, testType, callback) {
	var error;

	switch (testType) {
	case 'Error':
		error = new Error('This is an Error object');
		break;
	case 'string':
		error = 'string';
		break;
	case 'number':
		error = 0;
		break;
	case 'object':
		error = { foo: 'bar' };
		break;
	case 'default':
		error = null;
		break;
	case 'assert':
		try {
			assert(false, 'assertion failed');
		} catch (assertError) {
			error = assertError;
		}
		break;
	default:
		throw new Error('Unknown testType for state.error: ' + testType);
	}

	state.error(error, 'state.error log message', callback);
};

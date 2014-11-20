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
	default:
		throw new Error('Unknown testType for state.error: ' + testType);
	}

	state.error(error, 'state.error log message', callback);
};

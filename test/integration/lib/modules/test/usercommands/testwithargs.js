exports.access = 'user';

exports.params = ['arg1', 'arg2', 'arg3'];

exports.execute = function (state, arg1, arg2, arg3, callback) {
	state.respond([arg1, arg2, arg3]);
	return callback();
};

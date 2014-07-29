exports.access = 'user';

exports.params = [];

exports.execute = function (state, callback) {
	state.respond('test');
	return callback();
};

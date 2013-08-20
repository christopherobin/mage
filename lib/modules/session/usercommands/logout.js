exports.access = 'anonymous';
exports.params = [];

exports.execute = function (state, cb) {
	if (state.session) {
		state.session.expire(state);
	}

	cb();
};

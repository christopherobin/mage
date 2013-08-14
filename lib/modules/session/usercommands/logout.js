exports.access = 'anonymous';
exports.params = [];

exports.execute = function (state, cb) {
	state.session.expire(state);
	cb();
};

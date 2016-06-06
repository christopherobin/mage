exports.acl = ['*'];
exports.params = [];

exports.execute = function (state, cb) {
	if (state.session) {
		state.session.expire(state, 'loggedOut');
	}

	cb();
};

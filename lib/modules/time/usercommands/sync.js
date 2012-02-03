exports.params = ['clientTime'];


exports.execute = function (state, clientTime, cb) {
	if (typeof clientTime !== 'number') {
		state.respond(0);
	} else {
		state.respond(Date.now() - clientTime);
	}

	cb();
};


exports.params = ['clientTime'];


exports.execute = function (state, clientTime, cb) {
	if (typeof clientTime !== 'number') {
		state.respondJson('0');
	} else {
		state.respondJson('' + (Date.now() - clientTime));
	}

	cb();
};


exports.access = 'anonymous';

exports.params = ['clientTime'];


exports.execute = function (state, clientTime, cb) {
	if (typeof clientTime === 'number') {
		state.respondJson('' + (Date.now() - clientTime));
	} else {
		state.respondJson('0');
	}

	setTimeout(cb, 3000);
	//cb();
};

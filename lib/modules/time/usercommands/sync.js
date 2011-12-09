exports.params = [];


exports.execute = function (state, cb) {
	state.respond(Date.now());
	cb();
};


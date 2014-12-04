exports.access = 'user';

exports.params = [];

exports.execute = function (state, cb) {
	state.emit(state.actorId, 'syncEvent', { hello: 'world' });
	cb();
};

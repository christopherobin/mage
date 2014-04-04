exports.access = 'admin';

exports.params = ['topic', 'index', 'expirationTime'];


exports.execute = function (state, topic, index, expirationTime, cb) {
	state.archivist.touch(topic, index, expirationTime);
	cb();
};

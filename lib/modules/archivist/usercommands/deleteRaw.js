exports.params = ['topic', 'index'];


exports.execute = function (state, topic, index, cb) {
	state.archivist.del(topic, index);
	cb();
};


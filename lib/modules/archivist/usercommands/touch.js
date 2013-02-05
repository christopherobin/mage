exports.params = ['topic', 'index', 'ttl'];


exports.execute = function (state, topic, index, ttl, cb) {
	state.archivist.setTTL(topic, index, ttl);
	cb();
};

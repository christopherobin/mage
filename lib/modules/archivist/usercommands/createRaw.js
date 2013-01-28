exports.params = ['topic', 'vars', 'mediaType', 'data', 'encoding', 'ttl'];


exports.execute = function (state, topic, vars, mediaType, data, encoding, ttl, cb) {
	state.archivist.createRaw(topic, vars, mediaType, data, encoding, ttl);
	cb();
};


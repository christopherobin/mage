exports.params = ['topic', 'index', 'mediaType', 'data', 'encoding', 'ttl'];


exports.execute = function (state, topic, index, mediaType, data, encoding, ttl, cb) {
	state.archivist.createRaw(topic, index, mediaType, data, encoding, ttl);
	cb();
};


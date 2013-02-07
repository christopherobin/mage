exports.params = ['topic', 'index', 'data', 'mediaType', 'encoding', 'ttl'];


exports.execute = function (state, topic, index, data, mediaType, encoding, ttl, cb) {
	state.archivist.create(topic, index, data, mediaType, encoding, ttl);
	cb();
};

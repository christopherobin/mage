exports.params = ['topic', 'index', 'data', 'mediaType', 'encoding', 'expirationTime'];


exports.execute = function (state, topic, index, data, mediaType, encoding, expirationTime, cb) {
	state.archivist.create(topic, index, data, mediaType, encoding, expirationTime);
	cb();
};

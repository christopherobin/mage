exports.access = 'admin';

exports.params = ['topic', 'index', 'data', 'mediaType', 'encoding', 'expirationTime'];


exports.execute = function (state, topic, index, data, mediaType, encoding, expirationTime, cb) {
	try {
		state.archivist.set(topic, index, data, mediaType, encoding, expirationTime);
	} catch (error) {
		return state.error(null, error, cb);
	}

	cb();
};

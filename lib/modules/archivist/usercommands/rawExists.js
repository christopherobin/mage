exports.access = 'anonymous';

exports.params = ['topic', 'index'];


exports.execute = function (state, topic, index, cb) {
	state.archivist.exists(topic, index, function (error, exists) {
		if (error) {
			return cb(error);
		}

		state.respond(exists);

		cb();
	});
};

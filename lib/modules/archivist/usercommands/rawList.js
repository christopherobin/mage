exports.access = 'anonymous';

exports.params = ['topic', 'partialIndex', 'options'];


exports.execute = function (state, topic, partialIndex, options, cb) {
	state.archivist.list(topic, partialIndex, options, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		state.respond(indexes);

		cb();
	});
};

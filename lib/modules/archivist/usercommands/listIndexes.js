exports.params = ['topic', 'partialIndex'];


exports.execute = function (state, topic, partialIndex, cb) {
	state.archivist.listIndexes(topic, partialIndex, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		state.respond(indexes);

		cb();
	});
};

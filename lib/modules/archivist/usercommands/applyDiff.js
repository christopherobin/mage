exports.params = ['topic', 'index', 'diff'];


exports.execute = function (state, topic, index, diff, cb) {
	state.archivist.readValue(topic, index, { optional: false }, function (error, value) {
		if (error) {
			return cb(error);
		}

		try {
			value.applyDiff(diff);
		} catch (e) {
			return state.error(null, e, cb);
		}

		cb();
	});
};

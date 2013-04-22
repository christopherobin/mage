exports.access = 'admin';

exports.params = ['topic', 'index', 'diff'];


exports.execute = function (state, topic, index, diff, cb) {
	state.archivist.getValue(topic, index, { optional: false }, function (error, value) {
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

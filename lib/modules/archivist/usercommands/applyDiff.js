exports.params = ['topic', 'vars', 'diff'];


exports.execute = function (state, topic, vars, diff, cb) {
	state.archivist.retrieveJacket(topic, vars, { optional: false }, function (error, jacket) {
		if (error) {
			return cb(error);
		}

		try {
			jacket.value.applyDiff(diff);
		} catch (e) {
			return state.error(null, e, cb);
		}

		cb();
	});
};


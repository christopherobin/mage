exports.access = 'admin';

exports.params = ['changes'];


exports.execute = function (state, changes, cb) {
	if (!Array.isArray(changes)) {
		return state.error(null, 'archivist.distribute expected an array of changes', cb);
	}

	var issues = [];
	var i, change;
	var toLoad = [];
	var diffs = [];
	var syncChanges = [];

	// to apply diffs, we need to load their values first
	// for other operations, queue them up for synchronous execution

	for (i = 0; i < changes.length; i++) {
		change = changes[i] || {};

		if (change.operation === 'applyDiff') {
			if (Array.isArray(change.diff) && change.diff.length > 0) {
				toLoad.push({ topic: change.topic, index: change.index });
				diffs.push(change.diff);
			}
		} else {
			syncChanges.push(change);
		}
	}

	// execute all synchronous changes

	for (i = 0; i < syncChanges.length; i++) {
		change = syncChanges[i] || {};

		switch (change.operation) {
		case 'add':
			state.archivist.add(change.topic, change.index, change.data, change.mediaType, change.encoding, change.expirationTime);
			break;
		case 'set':
			state.archivist.set(change.topic, change.index, change.data, change.mediaType, change.encoding, change.expirationTime);
			break;
		case 'touch':
			state.archivist.touch(change.topic, change.index, change.expirationTime);
			break;
		case 'del':
			state.archivist.del(change.topic, change.index);
			break;
		}
	}

	// if there is nothing to do asynchronously, bail out now

	if (toLoad.length === 0) {
		state.respond(issues);

		return cb();
	}

	// load all required values, so we can apply diffs on them

	state.archivist.mgetValues(toLoad, { optional: true }, function (error, values) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < values.length; i++) {
			var value = values[i];
			var diff = diffs[i];

			if (!value) {
				issues.push('Could not load ' + JSON.stringify({ topic: toLoad[i].topic, index: toLoad[i].index }));
				continue;
			}

			try {
				value.applyDiff(diff);
			} catch (e) {
				issues.push('Could not apply changes to ' + JSON.stringify({ topic: value.topic, index: value.index }));
			}
		}

		state.respond(issues);

		cb();
	});
};

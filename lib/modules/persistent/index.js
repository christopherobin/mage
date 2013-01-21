var mage = require('../../mage');


exports.getAll = function (state, cb) {
	var query = 'SELECT property, type, value FROM persistent_data WHERE actorId = ? AND language IN (?, ?) AND (expirationTime = 0 OR expirationTime >= ?)';
	var params = [state.actorId, '', state.language(), mage.core.time];

	state.datasources.db.getMapped(query, params, { key: 'property', type: 'type', value: 'value' }, null, cb);
};


exports.get = function (state, properties, removeAfterGet, cb) {
	var db = state.datasources.db;

	var query = 'SELECT property, type, value FROM persistent_data WHERE actorId = ? AND language IN (?, ?) AND (expirationTime = 0 OR expirationTime >= ?) AND property IN (' + db.getPlaceHolders(properties.length) + ')';
	var params = [state.actorId, '', state.language(), mage.core.time].concat(properties);

	db.getMapped(query, params, { key: 'property', type: 'type', value: 'value' }, null, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (removeAfterGet) {
			exports.del(state, properties, function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, data);
			});
		} else {
			cb(null, data);
		}
	});
};


exports.getOne = function (state, property, removeAfterGet, cb) {
	var query = 'SELECT type, value FROM persistent_data WHERE actorId = ? AND language IN (?, ?) AND (expirationTime = 0 OR expirationTime >= ?) AND property = ?';
	var params = [state.actorId, '', state.language(), mage.core.time, property];

	state.datasources.db.getOne(query, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		var value = row ? mage.core.PropertyMap.unserialize(row.type, row.value) : null;

		if (removeAfterGet) {
			exports.del(state, [property], function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, value);
			});
		} else {
			cb(null, value);
		}
	});
};


exports.set = function (state, propertyMap, expirationTime, cb) {
	var properties = propertyMap.getAllFlat(true, true);
	var len = properties.length;

	if (len === 0) {
		return cb();
	}

	var sql = 'REPLACE INTO persistent_data VALUES ';
	var params = [];
	var values = [];

	for (var i = 0; i < len; i++) {
		var info = properties[i];

		values.push('(?, ?, ?, ?, ?, ?)');
		params.push(state.actorId, info.property, info.language || '', info.type, info.value, expirationTime || 0);
	}

	sql += values.join(', ');

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.del = function (state, properties, cb) {
	var db = state.datasources.db;

	var sql = 'DELETE FROM persistent_data WHERE actorId = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
	var params = [state.actorId].concat(properties);

	db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.clear = function (state, cb) {
	var sql = 'DELETE FROM persistent_data WHERE actorId = ?';
	var params = [state.actorId];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


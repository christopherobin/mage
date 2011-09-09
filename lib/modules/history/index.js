var mithril = require('../../mithril'),
    async = require('async');


exports.setup = function (state, cb) {
	cb();
};


exports.addEvent = function (state, type, participants, propertyMap, cb) {
	var eventId = null;

	async.waterfall(
		[
			function (callback) {
				// create an event record

				var time = mithril.core.time;
				var sql = 'INSERT INTO history_event (type, creationTime) VALUES (?, ?)';
				var params = [type, time];

				state.datasources.db.exec(sql, params, null, callback);
			},
			function (info, callback) {
				// remember the created eventId

				eventId = info.insertId;

				// register any participants to the event

				if (!participants || participants.length < 1) {
					return callback();
				}

				var sql = 'INSERT INTO history_event_actor (eventId, actorId) VALUES ';
				var params = [];
				var frag = [];

				participants.forEach(function (actorId) {
					frag.push('(?, ?)');
					params.push(eventId, actorId);
				});

				sql += frag.join(', ');

				state.datasources.db.exec(sql, params, null, function (error) {
					callback(error);
				});
			},
			function (callback) {
				// add given properties to this event

				exports.setProperties(state, eventId, propertyMap, callback);
			}
		],
		function (error) {
			cb(error);
		}
	);
};


exports.getEvents = function (state, type, dates, participants, dataFilter, cb) //TODO: test the shit out of this.
{							//		''    {f,t}	 [ida,idb..]
	var db = state.datasources.db;
	var eventsMap = {};
	var eventArr = [];
	var where = [];
	var params = [];
	var simpleWhere = null;
	var filterCount = 0;

	if (!participants) {
		participants = [];
	}

	if (!dataFilter) {
		dataFilter = [];
	}

	async.waterfall(
		[
			function (callback) {
				var query = 'SELECT he.id, he.type, he.creationTime FROM history_event AS he';
				var requireGroup = false;

				if (type) {
					where.push('he.type = ?');
					params.push(type);
				}

				if (dates) {
					where.push('creationTime BETWEEN ? AND ?');
					params.push(dates.from, dates.to);
				}

				if (participants.length > 0) {
					query += ' LEFT JOIN history_event_actor AS hea ON he.id = hea.eventId AND hea.actorId IN (' + db.getPlaceHolders(participants.length) + ')';
					where.push('hea.actorId IS NOT NULL');
					requireGroup = true;
				}

				filterCount = dataFilter.length;

				if (filterCount > 0) {
					simpleWhere = where.concat([]);

					for (var i = 0; i < filterCount; i++) {
						var filter = dataFilter[i];
						var alias = 'hed' + i;

						var conds = [alias + '.property = ?', alias + '.value = ?'];
						params.push(filter.property, mithril.core.PropertyMap.serialize(filter.value));

						/*if (filter.actorId)
						{
							conds.push(alias + '.actorId = ?');
							params.push(filter.actorId);
						}*/

						query += ' LEFT JOIN history_event_data AS ' + alias + ' ON he.id = ' + alias + '.eventId AND ' + conds.join(' AND ');
						where.push(alias + '.eventId IS NOT NULL'); //WHERE is now polluted with hed+1 etc
					}
					requireGroup = true;
				}

				if (where.length > 0) {
					query += ' WHERE ' + where.join(' AND ');
				}

				if (requireGroup) {
					query += ' GROUP BY he.type';
				}

				db.getMany(query, participants.concat(params), null, callback);
			},
			function (eventData, callback) {
				if (simpleWhere) {
					where = simpleWhere;
				}

				var i;

				for (i = 0; i < filterCount; i++) {
					params.pop();
					params.pop();
				}

				eventArr = eventData;

				if (participants.length < 1) {
					return callback();
				}

				var len = eventData.length;

				for (i = 0; i < len; i++) {
					var evt = eventData[i];
					evt.actors = [];
					evt.data = new mithril.core.PropertyMap();

					eventsMap[evt.id] = evt;
				}

				var query = 'SELECT hea.actorId, hea.eventId from history_event_actor AS hea JOIN history_event AS he ON hea.eventId = he.id';
				if (where.length > 0) {
					query += ' WHERE ' + where.join(' AND ');
				}

				db.getMany(query, params.concat([]), null, function (err, data) {
					if (err) {
						return callback(err);
					}

					for (var i = 0, len = data.length; i < len; i++) {
						var ea = data[i];
						var evt = eventsMap[ea.eventId];

						if (evt) {
							evt.actors.push(ea.actorId);
						}
					}

					callback();
				});
			},
			function (callback) {
				var query = 'SELECT hed.eventId, hed.actorId, hed.property, hed.language, hed.type, hed.value FROM history_event_data AS hed JOIN history_event AS he on hed.eventId = he.id JOIN history_event_actor AS hea ON he.id = hea.eventId ';
				if (where.length > 0)
				{
					query += ' WHERE ' + where.join(' AND ');
				}

				db.getMany(query, params, null, function (err, results) {
					if (err) {
						return callback(err);
					}

					for (var i = 0, len = results.length; i < len; i++) {
						var row = results[i];

						if (row.eventId in eventsMap) {
							eventsMap[row.eventId].data.importOne(row.property, row.type, row.value, row.language, row.actorId);
						}
					}
					callback();
				});
			}
		],
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, eventArr);
		}
	);
};


exports.setProperties = function (state, eventId, properties, cb) {
	var props = properties.getAllFlat(true);

	if (props.length === 0) {
		return cb();
	}

	var sql = 'INSERT INTO history_event_data VALUES';

	var values = [];
	var params = [];

	for (var i = 0, len = props.length; i < len; i++) {
		var prop = props[i];

		values.push('(?, ?, ?, ?, ?, ?)');
		params.push(eventId, prop.tag, prop.property, prop.language || '', typeof prop.value, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


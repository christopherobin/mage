//Mithril history module, TF July 1 2011


exports.setup = function(state, cb)
{
	cb();
};

exports.addEvent = function(state, type, participants, propertyMap, cb)
{								// ''	 []			   {}			(){}
	var eventId = null;
	async.waterfall(
		[
			function(callback) // insert into event table
			{
				var time = mithril.core.time;
				var sql = 'INSERT INTO history_event (type, creationTime) VALUES (?, ?)';
				var params = [type, time];
				state.datasources.db.exec(sql, params, null, callback);
			},
			function(info, callback) // insert into participants
			{
				eventId = info.insertId;
				if (!participants || participants.length < 1) { return callback(null, { insertId: null }); }
				
				var sql = 'INSERT INTO history_event_actor (eventId, actorId) VALUES ';
				var params = [];
				var frag = [];
				participants.forEach(function(actorId){
					frag.push('(?, ?)');
					params.push(eventId, actorId);
				});
				sql += frag.join(",");
				state.datasources.db.exec(sql, params, null, callback);
			},
			function(info, callback) // deal with data.
			{
				exports.setProperties(state, eventId, propertyMap, cb);
			}
		], 
		function(err)
		{
			cb(err);
		}
	);
};
									//consit with ranking
exports.getEvents = function(state, type, dates, participants, cb) //TODO: test the shit out of this.
{							//		''    [f,t]	 [ida,idb..]
	var eventsMap = {};
	var where = [];
	async.waterfall(
		[
			function(callback)
			{
				var params = [];
				var query = 'SELECT he.type, he.creationTime FROM history_event AS he';
			
				if(type)
				{
					where.push('type = ?');
					params.push(type);
				}
				if(dates)
				{
					where.push('creationTime BETWEEN ? AND ?');
					params.push(dates[0],dates[1]);
				}
				if(participants && participants.length > 0)
				{
					query += ' LEFT JOIN history_event_actor AS hea ON he.id = hea.eventId AND actorId IN (' + participants.map(function() { return '?'; }).join(', ') + ')';
					params = params.concat(participants);
					where.push('hea.actorId IS NOT NULL');
				}
				if(where.length>0)
				{
					query += ' WHERE ' + where.join(' AND ');
				}
				if(participants && participants.length > 0)
				{
					query += ' GROUP BY he.type';
				}
				state.datasources.db.getMany(query, params, null, callback);
			},
			function(eventData,callback)
			{
				if(!participants || participants.length < 1) { return callback(); }
				
				var len = eventData.length;
				
				for(var i=0;i<len;i++)
				{
					var evt = eventData[i];
					evt.actors = [];
					evt.data = new mithril.core.PropertyMap;
					eventsMap[evt.id] = evt;
				}
				
				var query = 'SELECT hea.actorId, hea.eventId from history_event_actor AS hea JOIN history_event AS he ON hea.eventId = he.id ';
				if(where.length>0)
				{
					query += ' WHERE ' + where.join(' AND ');
				}
				
				state.datasources.db.getMany(query, [evt.id], null, function(err,data){
					if(err) { return callback(err); }
					
					var len = data.length;
					for(var i=0;i<len;i++)
					{
						eventId = data[i].eventId;
						if(eventId in eventsMap)
						{
							eventsMap[eventId].actors.push(data[i].actorId);
						}
					}

					callback();
				});
			},
			function(callback)
			{
				var query = 'SELECT hed.eventId, actor, property, language, type, value FROM history_event_data AS hed JOIN history_event AS he on hed.eventId = he.id ';
				if(where.length>0)
				{
					query += ' WHERE ' + where.join(' AND ');
				}
				state.datasources.db.getMany(query, params, null, function(err, results) {
					if (err) return callback(err);

					var len = results.length;
					for (var i=0; i < len; i++)
					{
						var row = results[i];
			
						if (row.eventId in eventsMap)
						{
							eventsMap[row.eventId].data.importOne(row.property, row.type, row.value, row.language, row.actorId);
						}
					}
			
					callback();
				});
			}
		],
		function(err){
			cb(err)
		}
	);
};

exports.setProperties = function(state, eventId, properties, cb)
{
	var sql = 'INSERT INTO history_event_data VALUES';

	var values = [];
	var params = [];

	var props = properties.getAllFlat();

	var len = props.length;
	for (var i=0; i < len; i++)
	{
		var prop = props[i];

		values.push('(?, ?, ?, ?, ?, ?)');
		params.push(eventId, prop.tag, prop.property, prop.language || '', typeof prop.value, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		cb();
	});
};









/*
getEvents(state, type,  )


var data = new mithril.core.propertyMap;
data.add('place', 1, null, winnerId);
data.add('place', 2, null, loserId);

mithril.history.addEvent(state, 'pvp', [winnerId, loserId], data)
mithril.history.getEvents(state, 'pvp', now-24h, now, [me, otherGuy])

history_event
	id
	type
	creationTime

history_actor
	eventId
	actorId

history_event_data
	eventId
	actorId	NULL
	property
	language
	type
	value
*/
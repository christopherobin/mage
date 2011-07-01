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

exports.getEvents = function(state, type, dates, participants, cb) //TODO: test the shit out of this.
{							//		''    [f,t]	 [ida,idb..]
	var events = null;
	async.waterfall(
		[
			function(callback)
			{
				var params = [];
				var query = 'SELECT he.type, he.creationTime FROM history_event AS he';
				var where = [];
			
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
				if(participants) //TODO: will this return no records if join unsuccessful?
				{
					query += ' JOIN history_event_actor AS hea ON he.id = hea.eventId AND actorId IN (' + participants.map(function() { return '?'; }).join(', ') + ')';
					params = params.concat(participants);
				}
				if(where.length>0)
				{
					query += ' WHERE ' + where.join(' AND ');
				}
				state.datasources.db.getMany(query, params, null, callback);
			},
			function(eventData,callback)
			{
				events = eventData;
				if(!participants) { return callback(); }
				async.forEach(events, function(evt, itCb)
					{
					var query = 'SELECT actorId from history_event_actor WHERE eventId = ?';
					state.datasources.db.getMany(query, [evt.id], null, function(err,actorIds){
						if(!err)
						{
							evt.actors = actorIds;
						}
						itCb();
					});
				}, callback);
			},
			function(callback)
			{
				async.forEach(events, function(evt, itCb)
				{
					exports.getProperties(state, evt.id, null, function(err,data){
						if(!err)
						{
							evt.data = data;
						}
						itCb();
					});
				}, callback);
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

exports.getProperties = function(state, eventId, properties, cb)
{
	// If a property is defined with the language AND without a language, one will overwrite the other without any guarantee about which is returned.
	// This is by design.

	var query = 'SELECT actor, property, type, value FROM history_event_data WHERE eventId = ? AND language IN (?, ?)';
	var params = [eventId, state.language(), ''];

	if (properties && properties.length > 0)
	{
		query += ' AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
		params = params.concat(properties);
	}

	state.datasources.db.getMapped(query, params, { key: 'property', type: 'type', value: 'value', actor: 'actor' }, null, function(error, data) {
		if (error) return cb(error);

		cb(null, data);
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
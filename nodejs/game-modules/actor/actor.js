exports.userCommands = {
	sync:     __dirname + '/usercommands/sync.js',
	getActor: __dirname + '/usercommands/getActor.js'
};


// queryable model structure

exports.getActor = function(state, id, cb)
{
	id = parseInt(id);

	var sql = 'SELECT creationTime FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(sql, params, true, null, function(error, actor) {
		if (error) return cb(error);

		actor.id = id;

		exports.getProperties(state, id, null, function(error, data) {
			if (error) return cb(error);

			actor.data = data;

			cb(null, actor);
		});
	});
};


exports.addActor = function(state, name, cb)
{
	// name may be:
	//   string
	//   { lang: string, lang: string, ..., lang: string }

	var time = mithril.core.time;

	var query = 'INSERT INTO actor (creationTime) VALUES (?)';
	var params = [time];

	state.datasources.db.exec(query, params, null, function(error, info) {
		if (error) return cb(error);

		var actor = { id: info.insertId, creationTime: time, data: {} };

		var properties = [];

		if (typeof name == 'string')
		{
			properties.push({ property: 'name', value: name });
			actor.data.name = name;
		}
		else
		{
			for (var language in name)
			{
				properties.push({ property: 'name', language: language, value: name });

				if (language == state.language())
				{
					actor.data.name = name;
				}
			}
		}

		exports.setProperties(state, actor.id, properties, function(error) {
			if (error) return cb(error);

			cb(null, actor);
		});
	});
};


exports.getProperties = function(state, actorId, properties, cb)
{
	// If a property is defined with the language AND without a language, one will overwrite the other without any guarantee about which is returned.
	// This is by design.

	var sql = 'SELECT property, type, value FROM actor_data WHERE actor = ? AND language IN (?, ?)';
	var params = [actorId, state.language(), ''];

	if (properties && properties.length > 0)
	{
		sql += ' AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
		params = params.concat(properties);
	}

	state.datasources.db.getMapped(sql, params, { key: 'property', type: 'type', value: 'value' }, null, function(error, data) {
		if (error) return cb(error);

		cb(null, data);
	});
};


exports.setProperties = function(state, actorId, properties, cb)
{
	var sql = 'INSERT INTO actor_data VALUES';

	var values = [];
	var params = [];

	var len = properties.length;
	for (var i=0; i < len; i++)
	{
		var prop = properties[i];

		values.push('(?, ?, ?, ?, ?)');
		params.push(actorId, prop.property, prop.language || '', typeof prop.value, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		cb();
	});
};


exports.delActor = function(state, id, cb)
{
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.

	var query = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(query, params, null, cb);
};


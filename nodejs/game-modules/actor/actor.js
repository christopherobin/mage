var mithril = require('../../mithril.js');


exports.userCommands = {
	sync:     __dirname + '/usercommands/sync.js',
	getActor: __dirname + '/usercommands/getActor.js'
};


// queryable model structure

exports.getActor = function(state, id, cb)
{
	id = ~~id;

	var query = 'SELECT creationTime FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, function(error, actor) {
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

	var sql = 'INSERT INTO actor (creationTime) VALUES (?)';
	var params = [time];

	state.datasources.db.exec(sql, params, null, function(error, info) {
		if (error) return cb(error);

		var actor = { id: info.insertId, creationTime: time, data: {} };

		var properties = new mithril.core.PropertyMap;

		if (typeof name == 'string')
		{
			properties.add('name', name);
			actor.data.name = name;
		}
		else
		{
			for (var language in name)
			{
				properties.add('name', name[language], language);

				if (language == state.language())
				{
					actor.data.name = name[language];
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

	var query = 'SELECT property, type, value FROM actor_data WHERE actor = ? AND language IN (?, ?)';
	var params = [actorId, state.language(), ''];

	if (properties && properties.length > 0)
	{
		query += ' AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
		params = params.concat(properties);
	}

	state.datasources.db.getMapped(query, params, { key: 'property', type: 'type', value: 'value' }, null, function(error, data) {
		if (error) return cb(error);

		cb(null, data);
	});
};


exports.setProperties = function(state, actorId, propertyMap, cb)
{
	var properties = propertyMap.getAllFlat(true, true);

	var sql = 'INSERT INTO actor_data VALUES';

	var values = [];
	var params = [];

	var len = properties.length;
	for (var i=0; i < len; i++)
	{
		var prop = properties[i];

		values.push('(?, ?, ?, ?, ?)');
		params.push(actorId, prop.property, prop.language || '', prop.type, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		state.emit(actorId, 'actor.data.edit', { properties: propertyMap.getAll(state.language()) });

		cb();
	});
};


exports.delProperties = function(state, actorId, properties, cb)
{
	var sql = 'DELETE FROM actor_data WHERE actor = ? AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
	var params = [actorId].concat(properties);

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		state.emit(actorId, 'actor.data.del', { properties: properties });

		cb();
	});
};


exports.delActor = function(state, id, cb)
{
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.

	var sql = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(sql, params, null, cb);
};


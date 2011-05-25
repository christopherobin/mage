/* Objects Module. TF April 2011 */

var joins = {
	collectionOwner:	{ sql: 'LEFT JOIN actor AS ? ON obj_collection.owner = ?.id' },
	collectionObject:	{ sql: 'JOIN obj_collection_object AS ? ON obj_collection.id = ?.collection' },
	object:  			{ sql: 'JOIN obj_object AS ? ON collectionObject.object = ?.id', requires:['collectionObject'] },
	objectData:			{ sql: 'JOIN obj_object_data AS ? ON object.id = ?.object', requires:['object'] }
};

var allowedFields = {
	collectionId:		'id',
	ownerId:           	'owner',
	parentId:          	'parent',
	collectionType:		'type',
	slotCount:			'slotCount',
	maxWeight:			'maxWeight',
	ownerName:          ['collectionOwner', 'name'],
	objectName:		  	['object', 'name'],
	objectWeight:	  	['object', 'weight'],
	objectId:		  	['object', 'id'],
	propertyName:		['objectData', 'property'],
	propertyValue:		['objectData', 'value']
};

exports.userCommands = {
	getAllObjects: __dirname + '/usercommands/getAllObjects.js'
};


exports.getCollectionsByType = function(state, type, max, cb)
{
	var query = 'SELECT id FROM obj_collection WHERE type = ?';

	if (max)
	{
		query += ' LIMIT ' + parseInt(max);
	}

	state.datasources.db.getMany(query, [type], null, cb);
};


exports.getFullCollectionByType = function(state, type, owner, cb)
{
	var collection = null;

	async.waterfall(
		[
			function(callback)
			{
				var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : ' IS ') + ' ? LIMIT 1';
				state.datasources.db.getOne(query, [type, owner], true, null, callback);
			},
			function(result, callback)
			{
				exports.getFullCollection(state, result.id, callback);
			},
			function(coll, callback)
			{
				collection = coll;
				callback();
			}
		],
		function(error) {
			if (error)
				cb(error);
			else
				cb(null, collection);
		}
	);
};


exports.getCollectionIdByType = function(state, type, owner, cb)
{
	var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : ' IS ') + ' ? LIMIT 1';

	state.datasources.db.getOne(query, [type, owner], true, null, function(error, collection) {
		if (error)
			cb(error);
		else
			cb(null, collection.id);
	});
};


exports.getFullCollection = function(state, collectionId, cb)
{
	var collection = null;
	var objects = {};	// quick object ID based lookup

	async.waterfall([
		function(callback)
		{
			var query = 'SELECT parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?';
			var params = [collectionId];
			state.datasources.db.getOne(query, params, true, null, callback);
		},
		function(data, callback)
		{
			collection = data;
			collection.id = collectionId;

			var query = 'SELECT o.id, co.slot, o.appliedToObject, o.weight, o.name FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? ORDER BY co.slot ASC';
			var params = [collectionId];
			state.datasources.db.getMany(query, params, null, callback);
		},
		function(data, callback)
		{
			collection.objects = data;

			var len = data.length;
			for (var i=0; i < len; i++)
			{
				var entry = data[i];
				entry.data = {};
				objects[entry.id] = entry;
			}

			var query = 'SELECT d.object, d.property, d.value FROM obj_object_data AS d JOIN obj_collection_object AS co ON co.object = d.object WHERE co.collection = ?';
			var params = [collectionId];
			state.datasources.db.getMany(query, params, null, callback);
		},
		function(data, callback)
		{
			var len = data.length;
			for (var i=0; i < len; i++)
			{
				var entry = data[i];
				if (entry.object in objects)
				{
					objects[entry.object].data[entry.property] = entry.value;
				}
			}
			callback();
		}
	],
	function(error) {
		if (error)
			cb(error);
		else
			cb(null, collection);
	});
};


exports.getCollection = function(state, collectionId, fields, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE obj_collection.id = ?" ;
	var params = [collectionId];

	if (objOptions)
	{
		if ('objectName' in objOptions)
		{
			query += " AND obj_object.name = ?";
			params.push(objOptions[objectName]);
		}
		if ('objectWeight' in objOptions)
		{
			query += " AND obj_object.weight = ?";
			params.push(objOptions[objectWeight]);
		}
		if ('propertyName' in objOptions)
		{
			query += " AND obj_object_data.property = ?";
			params.push(objOptions[propertyName]);
		}
		if ('propertyValue' in objOptions)
		{
			query += " AND obj_object_data.value = ?";
			params.push(objOptions[propertyValue]);
		}
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getActorCollections = function(state, ownerId, fields, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE obj_collection.owner = ?" ;
	var params = [ownerId];

	if (objOptions && Object.keys(objOptions).length > 0)
	{
		if ('objectName' in objOptions)
		{
			query += " AND obj_object.name = ?";
			params.push(objOptions[objectName]);
		}
		if ('objectWeight' in objOptions)
		{
			query += " AND obj_object.weight = ?";
			params.push(objOptions[objectWeight]);
		}
		if ('propertyName' in objOptions)
		{
			query += " AND obj_object_data.property = ?";
			params.push(objOptions[propertyName]);
		}
		if ('propertyValue' in objOptions)
		{
			query += " AND obj_object_data.value = ?";
			params.push(objOptions[propertyValue]);
		}
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getActorObjects = function(state, ownerId, cb)
{
	var query = "SELECT oo.id, oo.name, oo.weight, oo.appliedToObject FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object INNER JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id";
	state.datasources.db.getMany(query, [ownerId], null, cb);
};


exports.getActorObject = function(state, ownerId, objectId, cb)
{
	var query = "SELECT oo.id, oo.name, oo.weight, appliedToObject FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oo.id = ? AND oc.owner = ? GROUP BY oo.id";

	state.datasources.db.getOne(query, [objectId, ownerId], true, null, cb);
};


exports.addCollection = function(state, type, slotCount, maxWeight, parentCollection, owner, cb)
{
	var query = "INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES ( ?, ?, ?, ?, ? )";
	state.datasources.db.exec(query, [type, slotCount, maxWeight, parentCollection, owner], null, function(err, info) {
		if (err) return cb(err);

		if (owner)
		{
			state.emit(owner, 'obj.collection.add', { collectionId: info.insertId, collectionType: type, slotCount: slotCount, maxWeight:maxWeight, parentId: parentCollection, owner: owner });
		}

		cb(null, { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentCollection: parentCollection, owner: owner });
	});
};


exports.editCollection = function(state, collectionId, objFields, cb)
{
	//TODO: deal with change of ownership, or disallow it here

	var query = "SELECT id, owner FROM obj_collection WHERE id = ?"; //find out who this belongs to so we may notify them
	state.datasources.db.getOne(query, params, true, null, function(err, data) {
		if (err) return cb(err);

		var sql = "UPDATE obj_collection SET ";
		var params = [];
		var owner = null;

		if (data.owner) { owner = data.owner; }
		var emmission = { collectionId: data.id, owner:owner };

		for (var key in objFields)
		{
			if (key in allowedFields && !(allowedFields[key] instanceof Array))
			{
				sql += allowedFields[key] + " = ?";
				params.push(objFields[key]);

				var emmissionKey = (key.substr(-2) == "Id") ? key.substr(0, key.length-2) : key ; //does not remap collectionType.
				emmission[emmissionKey] = objFields[key];
			}
		}
		sql += " WHERE id = ?";
		params.push(collectionId);

		state.datasources.db.exec(sql, params, null, function(error, info) {
			if (error) return cb(error);

			if (owner)
			{
				state.emit(owner, 'obj.collection.edit', emmission); //untested
			}

			cb(null, info);
		});

	});
};


exports.delCollection = function(state, collectionId, objOptions, cb)
{
	//TODO: parse options: removeObjects, allowOrphanChildCollections, removeChildCollections, etc - cascade can take care of this for now.
	var query = "SELECT id, owner FROM obj_collection WHERE id = ?"; //find out who this belonged to so we may notify them
	state.datasources.db.getOne(query, params, true, null, function(err, data) {
		if (err) return cb(err);

		var sql = "DELETE FROM obj_collection WHERE id = ?";
		state.datasources.db.exec(sql, [collectionId], null, function(error, info){
			if (error) return cb(error);

			if (data.owner)
			{
				state.emit(data.owner, 'obj.collection.del', { collectionId: data.id, owner: data.owner }); //untested
			}

			cb(null, info);
		});
	});
};


exports.setCollectionOwnership = function(state, collectionId, actorId, cb) //untested
{
	var query = "SELECT id, parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?";
	state.datasources.db.getOne(query, params, true, null, function(err, data)
	{
		if (err) return cb(err);

		var sql = "UPDATE obj_collection SET owner = ? WHERE id = ?";
		state.datasources.db.exec(sql,[actorId, collectionId], null, function(error, info) {
			if (error) return cb(error);

			if (data.owner) //could be unowned
			{
				state.emit(data.owner, 'obj.collection.del', { collectionId: data.id, owner:data.owner });  //tell old owner he lost his stuff
			}

			if (actorId) //could be setting to unowned
			{
				state.emit(actorId, 'obj.collection.add', { collectionId: data.id, collectionType: data.type, slotCount: data.slotCount, maxWeight: data.maxWeight, parentId: data.parent, owner: actorId });
			}

			cb(null, info);
		});
	});
};


exports.getChildCollections = function(state, collectionId, objOptions, cb)
{
	var query = "SELECT * FROM obj_collection WHERE parent = ?";
	state.datasources.db.getMany(query, [collectionId], null, cb);
};


exports.addObjectToCollection = function(state, objectId, collectionId, options, cb)
{
	if (!options) options = {};

	var owner = null;
	var sql = "SELECT owner from obj_collection WHERE id = ?";
	var params = [collectionId];

	state.datasources.db.getOne(sql, params, true, null, function(err, data) {
		if (err) return cb(err);

		if (data.owner) { owner = data.owner; }

		if (!options.slot && options.slot !== 0) options.slot = null; // ?

		var removeFromCurrentCollections = function(cb)
		{
			sql = 'SELECT co.collection FROM obj_collection_object AS co JOIN obj_collection AS c ON c.id = co.collection WHERE co.object = ? AND co.collection <> ? AND c.owner = ?';
			params = [objectId, collectionId, owner];

			state.datasources.db.getMany(sql, params, null, function(err, data) {
				if (err) { if (cb) cb(error); return; }

				for (var i=0; i < data.length; i++)
				{
					exports.removeObjectFromCollection(state, objectId, data[i].collection, null);
				}
			});
		};

		var removeObjectFromSlot = function(cb)
		{
			exports.removeObjectFromSlot(state, collectionId, options.slot, owner, cb);
		};

		var createLink = function(cb)
		{
			if (owner)
			{
				state.emit(owner, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: options.slot });
			}
			var sql = "INSERT into obj_collection_object (collection, object, slot) VALUES (?, ?, ?)";
			var params = [collectionId, objectId, options.slot];

			state.datasources.db.exec(sql, params, null, cb);
		};


		var queries = [];

		if (options && options.removeFromCurrentCollections)
		{
			queries.push(removeFromCurrentCollections);
		}

		if (options.slot)
		{
			queries.push(removeObjectFromSlot);
		}

		queries.push(createLink);

		async.series(queries, cb);
	});
};


exports.removeObjectFromCollection = function(state, objectId, collectionId, requiredOwner, cb)
{
	var query = 'SELECT owner from obj_collection WHERE id = ?';
	state.datasources.db.getOne(query, [collectionId], true, null, function(err, data)
	{
		if (err) return cb(err);

		if (requiredOwner && data.owner != requiredOwner)
		{
			return state.error(null, 'Actor ' + requiredOwner + ' tried to remove object from collection ' + collectionId + ', which is owned by actor ' + data.owner + '.', cb);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE object = ? AND collection = ?';
		state.datasources.db.exec(sql, [objectId, collectionId], null, function(error, info) {
			if (error) return cb(error);

			if (data.owner && info.affectedRows > 0)
			{
				state.emit(data.owner, 'obj.collection.object.del', { objectId: objectId, collectionId: collectionId });
			}

			cb();
		});
	});
};


exports.removeObjectFromSlot = function(state, collectionId, slot, requiredOwner, cb)
{
	var query = 'SELECT owner from obj_collection WHERE id = ?';

	state.datasources.db.getOne(query, [collectionId], true, null, function(err, data) {
		if (err) return cb(err);

		if (requiredOwner && data.owner != requiredOwner)
		{
			return state.error(null, 'Actor ' + requiredOwner + ' tried to remove object from collection ' + collectionId + ', which is owned by actor ' + data.owner + '.', cb);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE collection = ? AND slot = ?';
		var params = [collectionId, slot];

		state.datasources.db.exec(sql, params, null, function(error, info) {
			if (error) return cb(error);

			if (data.owner && info.affectedRows > 0)
			{
				state.emit(data.owner, 'obj.collection.object.del', { collectionId: collectionId, slot: slot }); //untested
			}

			cb();
		});
	});
};


exports.getCollectionMembers = function(state, collectionId, cb)
{
	var query = "SELECT object, collection, slot FROM obj_collection_object WHERE collection = ? ORDER BY slot";
	state.datasources.db.getMany(query, [collectionId], null, cb);
};


exports.addObject = function(state, collections, name, weight, data, cb)
{
	// collections: [ { id: 3, slot: 5 }, { id: 10 } ]

	var id = null;
	var obj = { id: null, name: name, weight: weight, data: data };

	async.waterfall([
		function(callback)
		{
			// create the object

			var sql = 'INSERT INTO obj_object (name, weight) VALUES (?, ?)';
			state.datasources.db.exec(sql, [obj.name, obj.weight], null, callback);
		},
		function(info, callback)
		{
			// remember the ID

			obj.id = info.insertId;

			// store properties

			var records = [];
			var params = [];

			for (var property in data)
			{
				records.push('(?, ?, ?)');
				params.push(obj.id);
				params.push(property);
				params.push(data[property]);
			}

			if (records.length > 0)
			{
				var sql = 'INSERT INTO obj_object_data VALUES ' + records.join(', ');
				state.datasources.db.exec(sql, params, null, callback);
			}
			else
				callback(null, null);
		},
		function(info, callback)
		{
			// store collection links
			if (collections.length == 0)
			{
				callback();
				return;
			}

			var sql = 'SELECT id, owner FROM obj_collection WHERE owner IS NOT NULL AND id IN (' + collections.map(function(coll) { return '?'; }).join(', ') + ')';
			var params = collections.map(function(coll) { return coll.id; });

			state.datasources.db.exec(sql, params, null, function(error, ownedCollections) {
				if (error) { callback(error); return; }

				var records = [];
				var params = [];

				for (var i=0; i < collections.length; i++)
				{
					var coll = collections[i];

					records.push('(?, ?, ?)');
					params.push(coll.id);
					params.push(obj.id);
					params.push((coll.slot === undefined) ? null : coll.slot);

					// emit everything that happens to the owner

					ownedCollections.forEach(function(row) {
						if (row.id != coll.id) return;

						// new object

						state.emit(row.owner, 'obj.object.add', obj);

						// collection/object link

						var co = { objectId: obj.id, collectionId: coll.id };

						if (coll.slot !== undefined && coll.slot !== null)
						{
							co.slot = coll.slot;
						}

						state.emit(row.owner, 'obj.collection.object.add', co);
					});
				}

				if (records.length > 0)
				{
					var sql = 'INSERT INTO obj_collection_object VALUES ' + records.join(', ');
					state.datasources.db.exec(sql, params, null, callback);
				}
				else
					callback();
			});
		}
	],
	function(err) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			if (cb) cb(null, obj);
		}
	});
};


exports.editObject = function(state, id, name, weight, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData){
		if (err) return cb(err);

		var sql = "UPDATE obj_object SET name = ?, weight = ? WHERE id = ? ";
		state.datasources.db.exec(sql, [name, weight, id], null, function(error, info){
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i=0; i < len; i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.edit', { id: id, name: name, weight: weight }); //untested
			}

			cb(null, info);
		});
	});
};


exports.cloneObject = function(state, objectId, objPropertiesToIgnore, newCollectionId, optSlot, cb)
{	/*TODO: deal with properties; TEST*/

/*	objPropertiesToInclude = {
		spirit: null,
		level3: level
	};
*/
	if (!optSlot && optSlot !== 0) optSlot = null;

	var query = "SELECT * from obj_object WHERE id = ?";

	state.datasources.db.getOne(query, [objectId], true, null, function(err, data) {
		if (err) return cb(err);

		var sql = "INSERT INTO obj_object (name, weight, appliedToObject) VALUES (?, ?, ?)";
		var params = [data.name, data.weight, data.appliedToObject];

		state.datasources.db.exec(sql, params, null, function(err, info) {
			if (err) return cb(err);

			var newData = info;

			if (newCollectionId)
			{
				sql = "INSERT into obj_collection_object (collection, object, slot) VALUES (?,?,?)";
				params = [newCollectionId, info.insertId, optSlot];

				state.datasources.db.exec(sql, params, null, function(err, info) {
					if (err) return cb(err);

					cb(null, newData);
				});
			}
			else
				cb(null, newData);
		});
	});
};


exports.setObjectSlot = function(state, objectId, collectionId, slotNumber, cb) //effectively a move within a collection.  may want to add more checks
{
	var query = "SELECT owner FROM obj_collection INNER JOIN obj_collection_obj ON obj_collection.id = obj_collection_obj.collection WHERE collectionId = ? AND objectId = ? ";
	var params = [collectionId, objectId];

	state.datasources.db.getOne(query, params, true, null, function(err, data) {
		if (err) return cb(err);

		query = "UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?";
		params = [slotNumber, collectionId, objectId];

		state.datasources.db.exec(query, params, null, function(error) {
			if (error) return cb(error);

			if (data.owner)
			{
				state.emit(data.owner, 'obj.collection.object.setObjectSlot', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); //untested
			}

			cb();
		});
	});
};


exports.applyObjectToObject = function(state, objectId, applyToObjectId, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData) {
		if (err) return cb(err);

		var sql = 'UPDATE obj_object SET appliedToObject = ? WHERE id = ?';
		var params = [applyToObjectId, objectId];

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i=0; i < len; i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.applyToObj', { id: objectId, applyTo: applyToObjectId }); //untested
			}

			cb();
		});
	});
};


exports.detachObjectFromObject = function(state, objectId, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData) {
		if (err) return cb(err);

		var sql = "UPDATE obj_object SET appliedToObject = NULL WHERE id = ?";
		var params = [objectId];

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i=0; i < len; i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.appliedToObject.del', { id: objectId }); // untested
			}

			cb();
		});
	});
};


exports.detachObjectChildren = function(state, objectId, cb)
{
	// TODO: IMPLEMENT

	// notify all owners about the detaching

	cb(null);
};


exports.getObjectProperty = function(state, objectId, property, fallback, cb)
{	//requested properties is ['name',...].  If props undefined, [] or null, all come back.
	var query = 'SELECT value FROM obj_object_data WHERE object = ? AND property = ?';
	var params = [objectId, property];

	state.datasources.db.getOne(query, params, false, null, function(error, row) {
		if (error)
		{
			cb(error);
		}
		else
			cb(null, row ? row.value : fallback);
	});
};


exports.getObjectData = function(state, objectId, properties, cb)
{	//requested properties is ['name',...].  If props undefined, [] or null, all come back.
	var query = "SELECT object, property, value FROM obj_object_data WHERE object = ?";
	var params = [objectId];

	if (properties && properties.length > 0)
	{
		query += " AND property IN (";

		for (var i=0; i < properties.length; i++)
		{
			params.push(properties[i]);
			query += '?, ';
		}

		query = query.substr(0, query.length - 2);
		query += ")";
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getObjectDataByOwner = function(state, ownerId, cb)
{
	var query = "SELECT od.object, od.property, od.value FROM obj_object_data AS od JOIN obj_collection_object AS oc ON oc.object = od.object JOIN obj_collection AS c ON c.id = oc.collection WHERE c.owner = ? GROUP BY od.object, od.property";
	state.datasources.db.getMany(query, [ownerId], null, cb);
};


exports.setObjectData = function(state, objectId, data, cb)
{	// data is { key: value, key2: value2, ... }
	exports.getObjectOwners(state, objectId, function(error, ownerData) {
		if (error) return cb(error);

		var sql = 'INSERT INTO obj_object_data VALUES ';

		var values = [];
		var params = [];

		for (var property in data)
		{
			values.push('(?, ?, ?)');
			params.push(objectId, property, data[property]);
		}

		sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

		state.datasources.db.exec(sql, params, null, function(err, data) {
			if (err) return cb(err);

			var len = ownerData.length;
			for (var i=0; i < len; i++) // UNTESTED
			{
				state.emit(ownerData[i].owner, 'obj.object.data.edit', { id: objectId, data: data });
			}

			cb();
		});
	});
};


exports.delObjectData = function(state, objectId, properties, cb)
{	//properties should be []

	exports.getObjectOwners(state, objectId, function(error, ownerData) {
		if (error) return cb(error);

		var sql = "DELETE FROM obj_object_data WHERE object = ? AND property IN (";
		for (var i=0; i < properties.length; i++)
		{
			sql += '?, ';
		}

		sql = sql.substr(0, sql.length - 2);
		sql += ")";

		properties.unshift(objectId);

		state.datasources.db.exec(sql, properties, null, function(error) {
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i=0; i < len; i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.data.del', { id: objectId, data: properties }); // UNTESTED + KNOWN BUG: properties contains objectId
			}

			cb();
		});
	});
};


exports.delObject = function(state, objectId, cb)
{
	exports.getObjectOwners(state, objectId, function(error, owners) {
		if (error) return cb(error);

		// detach all attached objects

		exports.detachObjectChildren(state, objectId, function(error) {
			if (error) return cb(error);

			// notify all owners

			owners.forEach(function(row) {
				state.emit(row.owner, 'obj.object.del', { objectId: objectId });
			});

			// remove the object from the DB

			var sql = 'DELETE FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.exec(sql, params, null, cb);
		});
	});
};


exports.getObjectOwners = function(state, objectId, cb)
{
	var query = "SELECT DISTINCT oc.owner FROM obj_collection AS oc INNER JOIN obj_collection_object AS oco ON oc.id = oco.collection WHERE oco.object = ? ";
	state.datasources.db.getMany(query, [objectId], null, cb);
};


exports.getObjectById = function(state, objectId, cb)
{
	var query = "SELECT * FROM obj_object WHERE id = ?"
	state.datasources.db.getOne(query, [objectId], false, null, cb);
};


exports.getObjectByPropertyValues = function(state, property, arrValues, cb)
{
	//arrValues acts as an OR
	var len = arrValues.length;
	if (len <1)
	{
		return state.error(null, 'No values given for property ' + property + ' in obj.getObjectByPropertyValues()', cb);
	}

	// TODO: refactor SQL to use IN(?,?,..,?)

	var query = "SELECT * FROM obj_object AS oo JOIN obj_object_data AS od ON od.object = oo.id WHERE od.property = ? AND (od.value = ? ";

	for (var i=1; i < len; i++)
	{
		query += ' OR od.value = ? ';
	}

	query += ')';

	params = [property].concat(arrValues);
	state.datasources.db.getOne(query, params, false, null, cb);
};


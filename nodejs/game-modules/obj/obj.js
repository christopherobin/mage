/* Objects Module. TF April 2011 */

var errors = {
	ERROR_CONST: { module: 'objects', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

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
	state.datasources.db.getMany(query, [type], errors.ERROR_CONST, cb);
};


exports.getFullCollectionByType = function(state, type, owner, cb)
{
	async.waterfall(
	[
		function(callback) 
		{
			var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner = ? LIMIT 1';
			state.datasources.db.getOne(query, [type, owner], true, errors.ERROR_CONST, callback);
		},
		function(result, callback)
		{
			exports.getFullCollection(state, result.id, callback);
		}
	],
	cb);
};


exports.getFullCollection = function(state, collectionId, cb)
{
	var collection = null;
	var objects = {};	// quick object ID based lookup

	async.waterfall(
	[
		function(callback)
		{
			var query = 'SELECT parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?';
			var params = [collectionId];
			state.datasources.db.getOne(query, params, true, errors.ERROR_CONST,callback);
		},
		function(data, callback)
		{
			collection = data;
			collection.id = collectionId;
			query = 'SELECT o.id, co.slot, o.appliedToObject, o.weight, o.name FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? ORDER BY co.slot ASC';
			params = [collectionId];
			state.datasources.db.getMany(query, params, errors.ERROR_CONST,callback);
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
			query = 'SELECT d.object, d.property, d.value FROM obj_object_data AS d JOIN obj_collection_object AS co ON co.object = d.object WHERE co.collection = ?';
			params = [collectionId];
			state.datasources.db.getMany(query, params, errors.ERROR_CONST, callback);
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
			console.log("COLLECTION:", collection);
			if (cb) cb(null, collection);
		}
	]);
};


exports.getCollection = function(state, collectionId, fields, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE obj_collection.id = ?" ;
	var params = [collectionId];

	if (objOptions)
	{	if ('objectName' in objOptions)
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
	state.datasources.db.getMany(query, params, errors.ERROR_CONST, cb);
};


exports.getActorCollections = function(state, ownerId, fields, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE obj_collection.owner = ?" ;
	var params = [ownerId];
	if (objOptions && Object.keys(objOptions).length > 0)
	{	if ('objectName' in objOptions)
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
	state.datasources.db.getMany(query, params, errors.ERROR_CONST, cb);
};


exports.getActorObjects = function(state, ownerId, cb)
{
	var query = "SELECT oo.id, oo.name, oo.weight, appliedToObject FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object INNER JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id";
	state.datasources.db.getMany(query, [ownerId], errors.ERROR_CONST, cb);
};


exports.addCollection = function(state, type, slotCount, maxWeight, parentCollection, owner, cb)
{
	var query = "INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES ( ?, ?, ?, ?, ? )";
	state.datasources.db.exec(query, [type, slotCount, maxWeight, parentCollection, owner], errors.ERROR_CONST, function(err, info) {
		if (err) { if (cb) { cb(err); }}
		else
		{
			if(owner)
			{
				state.emit(owner, 'obj.collection.add', { collectionId: info.insertId, collectionType: type, slotCount: slotCount, maxWeight:maxWeight, parentId: parentCollection, owner:owner });
			}
			if (cb) { cb(null, { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentCollection: parentCollection, owner: owner }); }
		}
	});
};


exports.editCollection = function(state, collectionId, objFields, cb)
{	//TODO: deal with change of ownership, or disallow it here
	var query = "SELECT id, owner FROM obj_collection WHERE id = ?"; //find out who this belongs to so we may notify them
	state.datasources.db.getOne(query, params, true, errors.ERROR_CONST, function(err, data)
	{
		if(err) { if(cb) { cb(err); return; }}

		var sql = "UPDATE obj_collection SET ";
		var params = [];
		var owner = null;

		if(data.owner) { owner = data.owner; }
		var emmission = { collectionId: data.id, owner:owner };

		for (var key in objFields)
		{
			if (key in allowedFields && !(allowedFields[key] instanceof Array))
			{
				sql+= allowedFields[key] + " = ?";
				params.push(objFields[key]);

				var emmissionKey = (key.substr(-2) == "Id") ? key.substr(0, key.length-2) : key ; //does not remap collectionType.
				emmission[emmissionKey] = objFields[key];
			}
		}
		sql += " WHERE id = ?";
		params.push(collectionId);

		state.datasources.db.exec(sql, params, errors.ERROR_CONST, function(error,info){
			if (error) { if (cb) { cb(error); return; } }
			if(owner)
			{
				state.emit(owner, 'obj.collection.edit', emmission); //untested
			}
			if (cb) cb(null, info);
		});

	});
};


exports.delCollection = function(state, collectionId, objOptions, cb)
{
	//TODO: parse options: removeObjects, allowOrphanChildCollections, removeChildCollections, etc - cascade can take care of this for now.
	var query = "SELECT id, owner FROM obj_collection WHERE id = ?"; //find out who this belonged to so we may notify them
	state.datasources.db.getOne(query, params, true, errors.ERROR_CONST, function(err, data)
	{
		if (err) { if (cb) { cb(err); return; }	}

		var sql = "DELETE FROM obj_collection WHERE id = ?";
		state.datasources.db.exec(sql, [collectionId], errors.ERROR_CONST, function(error, info){
			if (error) { if (cb) { cb(error);} }
			if(data.owner)
			{
				state.emit(data.owner, 'obj.collection.del', { collectionId: data.id, owner:data.owner }); //untested
			}
			if (cb) cb(null, info);
		});
	});
};


exports.setCollectionOwnership = function(state, collectionId, actorId, cb) //untested
{
	var query = "SELECT id, parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?";
	state.datasources.db.getOne(query, params, true, errors.ERROR_CONST, function(err, data)
	{
		if (err) { if (cb) { cb(err);} }
		var sql = "UPDATE obj_collection SET owner = ? WHERE id = ?";
		state.datasources.db.exec(sql,[actorId, collectionId], errors.ERROR_CONST, function(error,info){
			if (error) { if (cb) { cb(error);} }
			else
			{
				if(data.owner) //could be unowned
				{
					state.emit(data.owner, 'obj.collection.del', { collectionId: data.id, owner:data.owner });  //tell old owner he lost his stuff
				}
				if(actorId) //could be setting to unowned
				{
					state.emit(actorId, 'obj.collection.add', { collectionId: data.id, collectionType: data.type, slotCount: data.slotCount, maxWeight:data.maxWeight, parentId:data.parent, owner:actorId });
				}
				if (cb) cb(null, info);
			}
		});
	});
};


exports.getChildCollections = function(state, collectionId, objOptions, cb)
{
	var query = "SELECT * FROM obj_collection WHERE parent = ?";
	state.datasources.db.getMany(query, [collectionId], errors.ERROR_CONST, cb);
};


exports.addObjectToCollection = function(state, objectId, collectionId, options, cb)
{
	if (!options) options = {};

	var owner = null;
	var sql = "SELECT owner from obj_collection WHERE id = ?";
	var params = [collectionId];

	state.datasources.db.getOne(sql, params, true, errors.ERROR_CONST, function(err, data)
	{
		if (err) { if (cb) { cb(err); return; }	}
		if (data.owner) { owner = data.owner; }

		state.datasources.db.wrapTransaction(function(db)
		{
			if (!options.slot && options.slot !== 0) options.slot = null; // ?

			var removeFromCurrentCollections = function(cb)
			{
				sql = 'SELECT co.collection FROM obj_collection_object AS co JOIN obj_collection AS c ON c.id = co.collection WHERE co.object = ? AND co.collection <> ? AND c.owner = ?';
				params = [objectId, collectionId, owner];

				state.datasources.db.getMany(sql, params, errors.ERROR_CONST, function(err, data) {
					if (err) { cb(); return; }

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
				if(owner)
				{
					state.emit(owner, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: options.slot });
				}
				var sql = "INSERT into obj_collection_object (collection, object, slot) VALUES (?, ?, ?)";
				var params = [collectionId, objectId, options.slot];

				db.exec(sql, params, errors.ERROR_CONST, cb);
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

			function runQuery(i)
			{
				if (queries[i+1])
					queries[i](function() { runQuery(i+1); });
				else
					queries[i](function() { db.unwrapTransaction(); });
			}
			runQuery(0);
		}, cb);
	},
	cb);
};


exports.removeObjectFromCollection = function(state, objectId, collectionId, requiredOwner, cb)
{
	var query = "SELECT owner from obj_collection WHERE id = ?";
	state.datasources.db.getOne(query, [collectionId], true, errors.ERROR_CONST, function(err, data)
	{
		if (err) { if (cb) { cb(err);} }
		if (requiredOwner && data.owner != requiredOwner)
		{
			state.error(1234);
			if (cb) cb(errors.ERROR_CONST);
			return;
		}

		var sql = "DELETE FROM obj_collection_object WHERE object = ? AND collection = ?";
		state.datasources.db.exec(sql, [objectId, collectionId], errors.ERROR_CONST, function(error, info) {
			if (error) { if (cb) { cb(error);} }
			else
			{	if (data.owner && info.affectedRows > 0)
				{
					state.emit(data.owner, 'obj.collection.object.del', { objectId: objectId, collectionId: collectionId });
				}
				if (cb) cb(null);
			}
		});
	});
};


exports.removeObjectFromSlot = function(state, collectionId, slot, requiredOwner, cb)
{
	var query = "SELECT owner from obj_collection WHERE id = ?";
	state.datasources.db.getOne(query, [collectionId], true, errors.ERROR_CONST, function(err, data)
	{
		if (err) { if (cb) { cb(err); return; }}

		if (requiredOwner && data.owner != requiredOwner)
		{
			state.error(1234);
			if (cb) cb(errors.ERROR_CONST);
			return;
		}

		var sql = "DELETE FROM obj_collection_object WHERE collection = ? AND slot = ?";
		var params = [collectionId, slot];

		state.datasources.db.exec(sql, params, errors.ERROR_CONST, function(error, info) {
			if (error) { if (cb) { cb(error); }}
			else
			{	if (data.owner && info.affectedRows > 0)
				{
					state.emit(data.owner, 'obj.collection.object.del', { collectionId: collectionId, slot: slot }); //untested
				}
				if (cb) cb(null);
			}
		});
	});
};


exports.getCollectionMembers = function(state, collectionId, cb)
{
	var query = "SELECT object, collection, slot FROM obj_collection_object WHERE collection = ? ORDER BY slot";
	state.datasources.db.getMany(query, [collectionId], errors.ERROR_CONST, cb);
};


exports.addObject = function(state, name, weight,  cb)
{
	var sql = "INSERT INTO obj_object (name, weight) VALUES ( ?, ? )";
	state.datasources.db.exec(sql, [name, weight], errors.ERROR_CONST, cb);
};


exports.editObject = function(state, id, name, weight, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData){
		if(err) { if(cb) {cb(err); return; }}

		var sql = "UPDATE obj_object SET name = ?, weight = ? WHERE id = ? ";
		state.datasources.db.exec(sql, [name, weight, id], errors.ERROR_CONST, function(error, info){
			if(error) { if(cb) {cb(error); return; }}

			var len = ownerData.length;
			for(var i=0;i<len;i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.edit', { id: id, name: name, weight: weight }); //untested
			}
			if (cb) {cb(null, info); }
		});
	});
};


exports.cloneObject = function(state, objectId, objPropertiesToIgnore, newCollectionId, optSlot, cb)
{	/*TODO: deal with properties; TEST*/
	var newData = null;
//card:spiritname

/*	objPropertiesToInclude = {
		spirit: null,
		level3: level
	};
*/
	state.datasources.db.wrapTransaction(function(db)
	{
		if (!optSlot && optSlot !== 0) optSlot = null;

		var query = "SELECT * from obj_object WHERE id = ?";
		db.getOne(query, [objectId], true, errors.ERROR_CONST, function(err,data)
		{
			var sql = "INSERT INTO obj_object (name, weight, appliedToObject) VALUES (?, ?, ?)";
			var params = [data.name, data.weight, data.appliedToObject];
			db.exec(sql, params, errors.ERROR_CONST, function(err, info)
			{
				newData = info;
				if (newCollectionId)
				{
					sql = "INSERT into obj_collection_object (collection, object, slot) VALUES (?,?,?)";
					params = [newCollectionId, info.insertId, optSlot];
					db.exec(sql, params, errors.ERROR_CONST);
				}
				db.unwrapTransaction();
			});
		});
	}, function(err) { if (cb) cb(err, newData); });
};


exports.setObjectSlot = function(state, objectId, collectionId, slotNumber, cb) //effectively a move within a collection.  may want to add more checks
{
	var query = "SELECT owner FROM obj_collection INNER JOIN obj_collection_obj ON obj_collection.id = obj_collection_obj.collection WHERE collectionId = ? AND objectId = ? ";
	state.datasources.db.getOne(query, [collectionId, objectId], true, errors.ERROR_CONST, function(err,data)
	{
		if(err) { if(cb) { cb(err); return; }}

		var sql = "UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?";
		state.datasources.db.exec(sql, [slotNumber, collectionId, objectId], errors.ERROR_CONST, function(error, info){
			if(error) { if(cb) { cb(error); return; }}
			if(data.owner)
			{
				state.emit(data.owner, 'obj.collection.object.setObjectSlot', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); //untested
			}
			if(cb) { cb(null, info); }
		});
	});
};


exports.applyObjectToObject = function(state, objectId, applyToObjectId, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData){
		if(err) { if(cb) { cb(err); return; }}

		var sql = "UPDATE obj_object SET appliedToObject = ? WHERE id = ?";
		state.datasources.db.exec(sql, [applyToObjectId, objectId], errors.ERROR_CONST, function(error, info){
			if(error) { if(cb) { cb(error); return; }}

			var len = ownerData.length;
			for(var i=0;i<len;i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.applyToObj', { id: objectId, applyTo: applyToObjectId }); //untested
			}
			if(cb) { cb(null, info); }
		});
	});
};


exports.detachObjectFromObject = function(state, objectId, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData){
		if(err) { if(cb) { cb(err); return; }}

		var sql = "UPDATE obj_object SET appliedToObject = null WHERE id = ?";
		state.datasources.db.exec(sql, [objectId], errors.ERROR_CONST, function(error, info){
			if(error) { if(cb) { cb(error); return; }}

			var len = ownerData.length;
			for(var i=0;i<len;i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.detachFromObj', { id: objectId }); //untested
			}
			if(cb) { cb(null, info); }
		});
	});
};


exports.getObjectData = function(state, objectId, properties, cb)
{	//requested properties is ['name',...].  If props undefined, [] or null, all come back.
	var params = [objectId];
	var query = "SELECT object, property, value FROM obj_object_data WHERE object = ?";

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

	state.datasources.db.getMany(query, [id], errors.ERROR_CONST, cb);
};


exports.getObjectDataByOwner = function(state, ownerId, cb)
{
	var query = "SELECT od.object, od.property, od.value FROM obj_object_data AS od JOIN obj_collection_object AS oc ON oc.object = od.object JOIN obj_collection AS c ON c.id = oc.collection WHERE c.owner = ? GROUP BY od.object, od.property";
	state.datasources.db.getMany(query, [ownerId], errors.ERROR_CONST, cb);
};


exports.setObjectData = function(state, objectId, data, cb)
{	// data is { key: value, key2: value2, ... }
	console.dir('setObjectData started');

	exports.getObjectOwners(state, objectId, function(error, ownerData) {
		if (error) { if (cb) cb(error); return; }

		console.dir('Found owners');

		var sql = 'INSERT INTO obj_object_data VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)';

		for (var property in data)
		{
			var params = [objectId, property, data[property]];
			state.datasources.db.exec(sql, params, errors.ERROR_CONST);
		}

		var len = ownerData.length;
		for (var i=0;i<len;i++) //untested
		{
			state.emit(ownerData[i].owner, 'obj.object.data.edit', { id: objectId, data: data });
		}

		if (cb) { cb(null); }
	});
};


exports.delObjectData = function(state, objectId, properties, cb)
{	//properties should be []
	sql = "DELETE FROM obj_object_data WHERE object = ? and property IN (";
	for(var i=0;i<properties.length;i++)
	{
		sql += '?, ';
	}
	sql = sql.substr(0,sql.length - 2);
	sql += ")";
	properties.unshift(objectId);

	exports.getObjectOwners(state, objectId, function(error, ownerData){
		if(error) { if(cb) {cb(error)}}
		else
		{
			state.datasources.db.exec(sql, properties, errors.ERROR_CONST, cb);

			var len = ownerData.length;
			for(var i=0;i<len;i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.data.del', { id: objectId, data: properties }); //untested
			}
			if(cb) { cb(null); }
		}
	});
};


exports.getObjectOwners = function(state, objectId, cb)
{
	var query = "SELECT DISTINCT oc.owner FROM obj_collection AS oc INNER JOIN obj_collection_object AS oco ON oc.id = oco.collection WHERE oco.object = ? ";
	state.datasources.db.getMany(query, [objectId], errors.ERROR_CONST, cb);
};


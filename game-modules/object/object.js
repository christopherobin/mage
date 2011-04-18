// Objects Module. TF April 2011

var errors = {
	ERROR_CONST: { module: 'objects', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

var joins = {
	collectionOwner:	{ sql: 'LEFT JOIN actor AS ? ON obj_collection.owner = ?.id' },
	collectionObject:	{ sql: 'JOIN obj_collection_object AS ? ON obj_collection.collection = ?.id' },
	object:  			{ sql: 'JOIN object AS ? ON obj_collection_object.object = ?.id', requires:'collectionObject' },
	objectData:			{ sql: 'JOIN object_object_data AS ? ON object_object_data.object = ?.id', requires:'object' }
}

var allowedFields = {
	ownerId:           	'owner',
	parentId:          	'parent',
	collectionType:		'type',
	slotCount:			'slotCount',
	ownerName:          ['collectionOwner', 'name'],
	objectName:		  	['object', 'name'],
	propertyName:		[]
}

exports.getCollection = function(state, collectionId, fields, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE id = ?" ;
	var params = [collectionId];

	if(objOptions && Object.keys(objOptions).length > 0)
	{
		if('objectName' in objOptions)
		{
			query += " AND obj_object.name = ?";
			params.push(objOptions[objectName]);
		}
		if('propertyName' in objOptions)
		{
			query += " AND obj_object_data.property = ?";
			params.push(objOptions[propertyName]);
		}
	}
	state.datasources.db.getMany(query, params, errors.ERROR_CONST, cb);
};

exports.addCollection = function(state, type, slotCount, parentCollection, owner, cb)
{
	var query = "INSERT INTO obj_collection (type, slotCount, parent, owner) VALUES ( ?, ?, ?, ? )";
	state.datasources.db.exec(query, [type, slotCount, parentCollection, owner], errors.ERROR_CONST, function(err, info) {
		if (err)
			cb(err);
		else
			cb(null, { id: info.insertId, type: type, slotCount: slotCount, parentCollection: parentCollection, owner: owner });
	});
};

exports.editCollection = function(state, collectionId, objFields, cb)
{
	var query = "UPDATE obj_collection SET ";
	var params = [];

	// TODO: limit allowedFields to obj_collection writeable fields, and what if allowedFields[key] is an array?
	for(var key in objFields)
	{
		if(key in allowedFields)
		{
			query+= allowedFields[key] + " = ?";
			params.push(objFields[key]);
		}
	}

	query += " WHERE id = ?";
	params.push(collectionId);
	state.datasources.db.exec(query, params, errors.ERROR_CONST, cb);
};

exports.delCollection = function(state, collectionId, objOptions, cb)
{
	//TODO: parse options: removeObjects, allowOrphanChildCollections, removeChildCollections, etc
	var sql = "DELETE FROM obj_collection WHERE id = ?";
	state.datasources.db.exec(sql,[collectionId], errors.ERROR_CONST, cb);
};

exports.setCollectionOwnership = function(state, collectionId, actorId, cb)
{
	var sql = "UPDATE obj_collection SET owner = ? WHERE id = ?";
	state.datasources.db.exec(sql,[actorId, collectionId], errors.ERROR_CONST, cb);
};

exports.getPlayerCollections = function(state, owner, objOptions, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE owner = ?";
	var params = [owner];
	
	if(objOptions && Object.keys(objOptions).length > 0)
	{
		if('parent' in objOptions)
		{
			query += " AND obj_collection.parent = ?";
			params.push(objOptions[parent]);
		}
	}
	state.datasources.db.getMany(query, [owner], errors.ERROR_CONST, cb);
};

exports.getChildCollections = function(state, collectionId, objOptions, cb)
{
	var query = "SELECT * FROM obj_collection WHERE parent = ?";
	state.datasources.db.getMany(query, [collectionId], errors.ERROR_CONST, cb);
};

exports.addObjectToCollection = function(state, objectId, collectionId, optSlot, objOptions, cb)
{
	state.datasources.db.wrapTransaction(function(db)
	{
		if (!optSlot && optSlot !== 0) optSlot = null;

		params = [collectionId, objectId, optSlot];

		var sql = "INSERT into obj_collection_object (collection, object, slot) VALUES (?, ?, ?)";
		
		state.datasources.db.exec(sql, params, errors.ERROR_CONST, cb);
			
		if(objOptions && Object.keys(objOptions).length > 0)
		{
			if(objOptions && objOptions.removeFromCurrentCollections)
			{
				sql = "DELETE from obj_collection_object WHERE collection <> ?";
				db.exec(sql, [collectionId], errors.ERROR_CONST, function(err, data){
					db.unwrapTransaction();
				});
			}
		}
		else
		{	db.unwrapTransaction();	}
	}, cb);
};

exports.cloneObject = function(state, objectId, objPropertiesToIgnore, newCollectionId, cb)
{ /*TODO: deal with properties; TEST*/
	state.datasources.db.wrapTransaction(function(db)
	{
		var query = "SELECT * from obj_object WHERE id = ?";
		db.getOne(query, [objectId], true, errors.ERROR_CONST, function(err,data)
		{
			var params = [data.name, data.appliedToObject];
			var sql = "INSERT INTO obj_object (name, appliedToObject) VALUES ( ? , ? )";
			db.exec(sql, params, errors.ERROR_CONST, function(err, info)
			{
				if(newCollectionId)
				{
					sql = "INSERT into obj_collection_object (collection, object) VALUES (?,?)";
					params = [newCollectionId, info.insertId];
					db.exec(sql, params, errors.ERROR_CONST);
				}

				db.unwrapTransaction();	
			});
		});
	}, cb);
};

exports.removeObjectFromCollection = function(state, objectId, collectionId, cb)
{
	var sql = "DELETE FROM obj_collection_object WHERE object = ? AND collection = ?";
	state.datasources.db.exec(sql, [objectId, collectionId], errors.ERROR_CONST, cb);
};

exports.setObjectSlot = function(state, objectId, collectionId, slotNumber, cb)
{
	var sql = "UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?"
	state.datasources.db.exec(sql, [slotNumber, collectionId, objectId], errors.ERROR_CONST, cb);
};

exports.applyObjectToObject = function(state, objectId, applyToObjectId, cb)
{
	var sql = "UPDATE obj_object SET appliedToObject = ? WHERE id = ?"
	state.datasources.db.exec(sql, [applyToObjectId, objectId], errors.ERROR_CONST, cb);
};

exports.detachObjectFromObject = function(state, objectId, cb)
{
	var sql = "UPDATE obj_object SET appliedToObject = null WHERE id = ?"
	state.datasources.db.exec(sql, [objectId], errors.ERROR_CONST, cb);
};

exports.getObjectData = function(state, objectId, properties, cb)
{
	var params = [objectId];

	var query = "SELECT property, value FROM obj_object_data WHERE object = ? AND property IN (";
	for (var i=0;i<properties.length;i++)
	{
		params.push(properties[i]);
		query += "? ,";
	}
	query = query.substr(0,query.length - 2);
	query += ")";

	state.datasources.db.getMany(query, params, errors.ERROR_CONST, cb);
};

exports.setObjectData = function(state, objectId, data, cb)	
{
	var sql = 'INSERT INTO obj_object_data VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)';

	for(var property in data)
	{	
		var params = [objectId, property, data[property]];

		state.datasources.db.exec(sql, params, errors.ERROR_CONST, cb);
	}
};

exports.delObjectData = function(state, objectId, properties, cb)
{
	sql = "DELETE FROM obj_object_data WHERE object = ? and property IN (";
	for(var i=0;i<properties.length;i++)
	{
		sql += "? ,";
	}
	sql = sql.substr(0,sql.length - 2);
	sql += ")";

	properties.unshift(objectId);
	state.datasources.db.exec(sql, properties, errors.ERROR_CONST, cb);
};

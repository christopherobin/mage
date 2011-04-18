// Objects Module. TF April 2011

var errors = {
	ERROR_CONST: { module: 'objects', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

var joins = {
	collectionOwner:	{ sql: 'JOIN actor AS ? ON obj_collection.owner = ?.id' },
	collectionObject:	{ sql: 'JOIN obj_collection_object AS ? ON obj_collection.collection = ?.id' },
	object:  			{ sql: 'JOIN object AS ? ON obj_collection_object.object = ?.id', requires:'object' },
	objectData:			{ sql: 'JOIN object_object_data AS ? ON object_object_data.object = ?.id', requires:'collectionObject' }
}

var allowedFields = {
	ownerId:           	'owner',
	parentId:          	'parent',
	collectionType:		'type',
	slotCount:			'slotCount',
	ownerName:          ['collectionOwner', 'name'],
	objectName:		  	['object', 'name']
}

exports.getCollection = function(state, collectionId, fields, objOptions, cb){
	// TODO: Parse objOptions as where clase.
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE id = ?" ;

	state.datasources.db.getMany(query, [collectionId], errors.ERROR_CONST, cb);
};


exports.addCollection = function(state, type, slotCount, parentCollection, cb){
	
	var query = "INSERT INTO collection (type, slotCount, parent) VALUES ( ?, ?, ? )";
	
	state.datasources.db.exec(query, [type, slotCount, parentCollection], errors.ERROR_CONST, cb);
	
};

exports.editCollection = function(state, collectionId, objFields, cb){
	
	var query = "UPDATE obj_collection SET ";
	
	var params = [];
	
	for(var key in objFields)
	{
		if(key in allowedFields)
		{
			query+= allowedFields[key] + " = ?";
			params.push(objFields[key]);
		}
	}
	query = query.substring(0,query.lenth-2);
	
	query += " WHERE id = ?";
	
	params.push(collectionId);
	
	state.datasources.db.exec(query, params, errors.ERROR_CONST, cb);
};

exports.delCollection = function(state, collectionId, objOptions, cb){
	
	//TODO: parse options: removeObjects, allowOrphanChildCollections, removeChildCollections, etc
	
	var sql = "DELETE FROM obj_collection WHERE id = ?";
	state.datasources.db.exec(sql,[collectionId], errors.ERROR_CONST, cb);
};

exports.setCollectionOwnership = function(state, collectionId, actorId, cb){
	var sql = "UPDATE obj_collection SET owner = ? WHERE id = ?";
	state.datasources.db.exec(sql,[actorId, collectionId], errors.ERROR_CONST, cb);
};

exports.getPlayerCollections = function(state, owner, objOptions, cb)
{	
	//TODO: parse options as where clause - eg. type=xyz
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE owner = ?" ;
	state.datasources.db.getMany(query, [owner], errors.ERROR_CONST, cb);
};

exports.getChildCollections = function(state, collectionId, objOptions, cb)
{
	var query = "SELECT * FROM obj_collection WHERE parent = ?";  //TODO: change SELECT * ?
	state.datasources.db.getMany(query, [collectionId], errors.ERROR_CONST, cb);
};

exports.addObjectToCollection = function(state, objectId, collectionId, optSlot, objOptions, cb)
{ /*TODO: parse objOptions e.g moveFromExistingCol.
	TODO: deal with slots */
	
	var sql = "INSERT into obj_collection_object (collection, object) VALUES (?, ?)";
	state.datasources.db.exec(sql,[collectionId, objectId], errors.ERROR_CONST, cb);
};

exports.cloneObject = function(state, objectId, objPropertiesToIgnore, newCollectionId, cb)
{ /*TODO: deal with properties; TEST*/
	
	state.datasources.db.wrapTransaction(function(db){
				
		var query = "SELECT * from obj_object WHERE objectId = ?";
		db.getOne(query, [objectId], errors.ERROR_CONST, function(err,data){
			
			var params = [data.name, data.appliedToObject]
		
			var sql = "INSERT INTO obj_object (name, appliedToObject) VALUES ( ? , ? )";
			db.exec(sql, params, errors.ERROR_CONST, function(err, data){
				
				if(newCollectionId)
				{
					sql = "INSERT into obj_collection_object (collection, object) VALUES (?,?)";
					params = [newCollectionId, data.id];
					db.exec(sql, params, errors.ERROR_CONST, null);
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
	var query = "SELECT name, property, value from obj_object INNER JOIN obj_object_data on obj_object.id = obj_object_data WHERE property in (";
	for (var i=0;i<properties.length;i++)
	{
		query += properties[i] + " ,";
	}
	query = query.substr(0,query.length - 2);
	query += ");";
	state.datasources.db.exec(query, [], errors.ERROR_CONST, cb);
};

exports.setObjectData = function(state, objectId, data, cb)	// this could get expensive on big objs. reccomend one property per obj.
{
	for(var property in data)
	{	// TEST IF PROP EXISTS, IF SO REPLACE, ELSE INS.
		var sql = "SELECT count (*) as test FROM obj_object_data WHERE object = ? AND property = ?";
		state.datasources.db.getOne(sqlTestRequested, [objectId, property], errors.ERROR_CONST, function(err, data)
		{
			if (err)
			{
				cb(ERROR_CONST);
				retrun;
			}
			if(data.request != 1)
			{
				sql = "UPDATE obj_object_data SET value = ? WHERE object = ? AND property = ?";
				state.datasources.db.exec(sql, [data[property], objectId, property], errors.ERROR_CONST, cb);
			}
			else
			{
				sql = "INSERT INTO obj_object_data (object, property, value) VALUES (?, ?, ?)";
				state.datasources.db.exec(sql, [objectId, property, JSON.parse(data[property])], errors.ERROR_CONST, cb);
			}
		});
	}
};

exports.delObjectData = function(state, objectId, properties, cb)
{
	sql = "DELETE FROM obj_object_data WHERE object = ? and property IN (";
	for(var i=0;i<properties.length;i++)
	{
		sql += properties[i] + " ,";
	}
	sql = sql.substr(0,sql.length - 2);
	sql += ");";
	
	state.datasources.db.exec(sql, [objectId], errors.ERROR_CONST, cb);
};

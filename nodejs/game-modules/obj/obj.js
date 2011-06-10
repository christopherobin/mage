var joins = {
	collectionOwner:	{ sql: 'LEFT JOIN actor AS ? ON obj_collection.owner = ?.id' },
	collectionObject:	{ sql: 'JOIN obj_collection_object AS ? ON obj_collection.id = ?.collection' },
	object:  			{ sql: 'JOIN obj_object AS ? ON collectionObject.object = ?.id', requires: ['collectionObject'] },
	objectData:			{ sql: 'JOIN obj_object_data AS ? ON object.id = ?.object', requires: ['object'] }
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
	getAllObjects: __dirname + '/usercommands/getAllObjects.js',
	getAllClasses: __dirname + '/usercommands/getAllClasses.js'
};


var allClassesMap = {};
var allClassesArr = [];


exports.setup = function(state, cb)
{
	exports.loadAllClasses(state, function(error, classesArr) {
		if (error) return cb(error);

		allClassesArr = classesArr;

		classesArr.forEach(function(objClass) {
			allClassesMap[objClass.name] = objClass;
		});

		cb();
	});
};


// object class definitions
// ----------------------------------------------------------------------

exports.loadAllClasses = function(state, cb)
{
	// returns full class definitions, in all languages, all tags

	var sql = 'SELECT id, name, weight FROM obj_class';
	var params = [];

	state.datasources.db.getMany(sql, params, null, function(error, classes) {
		if (error) return cb(error);

		// read properties

		sql = 'SELECT classId, property, tag, language, type, behavior, value FROM obj_class_data';
		params = [];

		state.datasources.db.getMany(sql, params, null, function(error, data) {
			if (error) return cb(error);

			var clen = classes.length;
			var dlen = data.length;

			for (var i=0; i < clen; i++)
			{
				var objClass = classes[i];
				objClass.data = new mithril.core.PropertyMap();

				for (var j=0; j < dlen; j++)
				{
					var row = data[j];

					if (row.classId != objClass.id) continue;

					objClass.data.importOne(row.property, row.type, row.value, row.language, row.tag, { behavior: row.behavior });
				}
			}

			cb(null, classes);
		});
	});
};


exports.getAllClasses = function(language, behaviors)
{
	if (!language)
		return allClassesMap;

	var out = {};
	var len = allClassesArr.length;

	var fnFilter = behaviors ? function(prop) { return behaviors.indexOf(prop.meta.behavior) !== -1; } : null;

	for (var i=0; i < len; i++)
	{
		var objClass = allClassesArr[i];

		var outObj = {};

		if (objClass.weight !== null)
		{
			outObj.weight = objClass.weight;
		}

		if (objClass.data)
		{
			outObj.data = objClass.data.getAll(language, null, fnFilter);
		}

		out[objClass.name] = outObj;
	}

	return out;
};


exports.getClass = function(className)
{
	if (!(className in allClassesMap)) return false;

	return allClassesMap[className];
};


exports.getClassProperty = function(className, property, language, tags, behaviors, fallback)
{
	var objClass = allClassesMap[className];
	if (!objClass) return fallback;

	if (objClass.data)
	{
		return objClass.data.getOne(property, language, null, function(prop) { return behaviors.indexOf(prop.meta.behavior) !== -1; });
	}

	return fallback;
};


// objects
// ----------------------------------------------------------------------

exports.getActorObjects = function(state, ownerId, cb)
{
	var sql = "SELECT oo.id, oo.name, oo.weight, oo.appliedToObject FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object INNER JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id";
	state.datasources.db.getMany(sql, [ownerId], null, cb);
};


exports.getActorObject = function(state, ownerId, objectId, cb)
{
	var sql = "SELECT oo.id, oo.name, oo.weight, appliedToObject FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oo.id = ? AND oc.owner = ? GROUP BY oo.id";

	state.datasources.db.getOne(sql, [objectId, ownerId], true, null, cb);
};


exports.addObject = function(state, collections, name, weight, propertyMap, cb)
{
	// collections: [ { id: 3, slot: 5 }, { id: 10 } ]

	var objectId = null;

	// check class definition for "name", so that if it exists, we can apply its logic to this new object

	var objClass = allClassesMap[name];
	if (objClass)
	{
		if (!weight && weight !== 0)
		{
			weight = objClass.weight;
		}

		if (objClass.data)
		{
			// augment data with class data

			propertyMap.fillRequirements(objClass.data, function(prop) { return prop.meta.behavior === 'copy'; });
		}
	}

	// store object in DB:

	async.waterfall([
		function(callback)
		{
			// create the object

			var sql = 'INSERT INTO obj_object (name, weight) VALUES (?, ?)';
			state.datasources.db.exec(sql, [name, weight], null, callback);
		},
		function(info, callback)
		{
			// remember the ID

			objectId = info.insertId;

			// store properties

			var records = [];
			var params = [];

			var props = propertyMap.getAllFlat();
			var len = props.length;

			for (var i=0; i < len; i++)
			{
				var prop = props[i];

				records.push('(?, ?, ?, ?, ?)');
				params.push(objectId, prop.property, prop.language || '', prop.type, prop.value);
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

			var sql = 'SELECT c.id, c.owner, p.language FROM obj_collection AS c JOIN player AS p ON p.actor = c.owner WHERE c.id IN (' + collections.map(function() { return '?'; }).join(', ') + ')';
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
					params.push(objectId);
					params.push((coll.slot === undefined) ? null : coll.slot);

					// emit everything that happens to the owner

					ownedCollections.forEach(function(row) {
						if (row.id != coll.id) return;

						// new object

						var obj = {
							id: objectId,
							name: name,
							weight: weight
						};

						if (propertyMap)
							obj.data = propertyMap.getAll(row.language);

						state.emit(row.owner, 'obj.object.add', obj);

						// collection/object link

						var co = { objectId: objectId, collectionId: coll.id };

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
	function(error) {
		if (error) return cb(error);

		cb(null, objectId);
	});
};

/*
 * Not used
 *
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
*/

/*
 * Not used
exports.cloneObject = function(state, objectId, objPropertiesToIgnore, newCollectionId, optSlot, cb)
{
	// TODO: deal with properties; TEST

	// objPropertiesToInclude = { spirit: null, level3: level };

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
*/


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
				state.emit(ownerData[i].owner, 'obj.object.appliedToObjectId.edit', { id: objectId, to: applyToObjectId }); //untested
			}

			cb();
		});
	});
};


/*
 * not used
exports.detachObjectFromObject = function(state, objectId, cb)
{
	exports.getObjectOwners(state, objectId, function(err, ownerData) {
		if (err) return cb(err);

		var sql = 'UPDATE obj_object SET appliedToObject = NULL WHERE id = ?';
		var params = [objectId];

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i=0; i < len; i++)
			{
				state.emit(ownerData[i].owner, 'obj.object.edit', { id: objectId, property: 'appliedToObjectId', to: null }); //untested
			}

			cb();
		});
	});
};
*/


exports.detachObjectChildren = function(state, objectId, cb)
{
	// TODO: IMPLEMENT

	// notify all owners about the detaching

	cb(null);
};



exports.getObjectProperty = function(state, objectId, property, fallback, cb)
{
	var query = 'SELECT o.name, od.type, od.value FROM obj_object AS o LEFT JOIN obj_object_data AS od ON od.object = o.id AND od.property = ? AND od.language IN (?, ?) WHERE o.id = ?';
	var params = [property, '', state.language(), objectId];

	state.datasources.db.getOne(query, params, false, null, function(error, row) {
		if (error) return cb(error);

		if (row)
		{
			if (row.value !== null)
			{
				return cb(null, mithril.core.PropertyMap.unserialize(row.type, row.value));
			}

			// check if the object's class has this property defined as inherit

			var value = exports.getClassProperty(row.name, property, state.language(), null, ['inherit'], fallback);
			return cb(null, value);
		}

		return cb(null, fallback);
	});
};

/*
 * not used
 *
exports.getObjectData = function(state, objectId, properties, cb)
{
	// TODO: fallback to inherited class properties

	// properties: ['name', ...]
	// If properties evaluates to false or is an empty array, all properties for this object are returned.

	var query = 'SELECT property, type, value FROM obj_object_data WHERE object = ? AND language IN (?, ?)';
	var params = [objectId, '', state.language()];

	if (properties && properties.length > 0)
	{
		query += ' AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
		params = params.concat(properties);
	}

	state.datasources.db.getMapped(query, params, { key: 'property', value: 'value', type: 'type' }, null, function(error, results) {

	});
};
*/

exports.getObjectDataByOwner = function(state, ownerId, cb)
{
	var sql = 'SELECT od.object, od.property, od.type, od.value FROM obj_object_data AS od JOIN obj_collection_object AS oc ON oc.object = od.object JOIN obj_collection AS c ON c.id = oc.collection WHERE c.owner = ? AND od.language IN (?, ?) GROUP BY od.object, od.property';
	var params = [ownerId, '', state.language()];

	state.datasources.db.getMany(sql, params, null, function(error, results) {
		var props = [];
		var len = results.length;

		for (var i=0; i < len; i++)
		{
			var row = results[i];

			props.push({
				object: row.object,
				property: row.property,
				value: mithril.core.PropertyMap.unserialize(row.type, row.value)
			});
		}

		cb(null, props);
	});
};


exports.setObjectData = function(state, objectId, propertyMap, requiredOwnerId, cb)
{
	var requireClassProperties = propertyMap.hasRequirements();

	var name = null;
	var objClass = null;
	var owners = null;

	async.series([
		function(callback) {
			if (!requireClassProperties) return callback();

			// augment data object with "copy" style class properties

			var sql = 'SELECT name FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.getOne(sql, params, true, null, function(error, row) {
				if (error) return callback(error);

				name = row.name;
				objClass = allClassesMap[name];

				if (objClass.data)
				{
					if (!propertyMap.fillRequirements(objClass.data, function(prop) { return (!prop.meta || prop.meta.behavior == 'copy'); }))
					{
						return state.error(null, 'Filling object property requirements failed.', callback);
					}
				}

				callback();
			});
		},
		function(callback) {
			exports.getObjectOwners(state, objectId, function(error, results) {
				if (error) return callback(error);

				owners = results;

				if (requiredOwnerId && !owners.some(function(ownerData) { return ownerData.owner == requiredOwnerId; }))
				{
					return state.error(null, 'Actor ' + requiredOwnerId + ' does not own object ' + objectId + ', so cannot change properties.', callback);
				}

				callback();
			});
		},
		function(callback) {
			var sql = 'INSERT INTO obj_object_data VALUES ';

			var values = [];
			var params = [];

			var props = propertyMap.getAllFlat();
			var len = props.length;

			for (var i=0; i < len; i++)
			{
				var prop = props[i];

				values.push('(?, ?, ?, ?, ?)');
				params.push(objectId, prop.property, prop.language || '', prop.type, prop.value);
			}

			sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

			state.datasources.db.exec(sql, params, null, function(err) {
				if (err) return cb(err);

				var len = owners.length;
				for (var i=0; i < len; i++)
				{
					var owner = owners[i];

					state.emit(owner.owner, 'obj.object.data.edit', { objectId: objectId, data: propertyMap.getAll(owner.language) });
				}

				cb();
			});
		}
	],
	cb);
};


exports.delObjectData = function(state, objectId, properties, requiredOwnerId, cb)
{
	exports.getObjectOwners(state, objectId, function(error, owners) {
		if (error) return cb(error);

		if (requiredOwnerId && !owners.some(function(ownerData) { return ownerData.owner == requiredOwnerId; }))
		{
			return state.error(null, 'Actor ' + requiredOwnerId + ' does not own object ' + objectId + ', so cannot change properties.', callback);
		}

		var sql = 'DELETE FROM obj_object_data WHERE object = ? AND property IN (' + properties.map(function() { return '?'; }).join(', ') + ')';
		var params = [objectId].concat(properties);

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			var len = owners.length;
			for (var i=0; i < len; i++)
			{
				state.emit(owners[i].owner, 'obj.object.data.del', { objectId: objectId, properties: properties });
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
	var query = 'SELECT DISTINCT oc.owner FROM obj_collection AS oc JOIN obj_collection_object AS oco ON oc.id = oco.collection WHERE oco.object = ?';
	state.datasources.db.getMany(query, [objectId], null, cb);
};


exports.getObjectById = function(state, objectId, cb)
{
	var query = 'SELECT name, appliedToObject, weight FROM obj_object WHERE id = ?';
	state.datasources.db.getOne(query, [objectId], false, null, cb);
};

/*
 * removed, too dangerous, ownership is not taken into account
 * besides, this should use the class definitions
 */
exports.getObjectByPropertyValues = function(state, property, values, cb)
{
	// values acts as an OR
	if (!values || values.length < 1)
	{
		return state.error(null, 'No values given for property ' + property + ' in obj.getObjectByPropertyValues()', cb);
	}

	var query = 'SELECT id, name, appliedToObject, weight FROM obj_object AS oo JOIN obj_object_data AS od ON od.object = oo.id WHERE od.property = ? AND od.value IN (' + values.map(function() { return '?'; }).join(', ') + ') LIMIT 1';
	var params = [property].concat(values);

	state.datasources.db.getOne(query, params, false, null, cb);
};



// object collections
// ----------------------------------------------------------------------

/*
 * not used
exports.getCollectionsByType = function(state, type, max, cb)
{
	var query = 'SELECT id FROM obj_collection WHERE type = ?';

	if (max)
	{
		query += ' LIMIT ' + parseInt(max);
	}

	state.datasources.db.getMany(query, [type], null, cb);
};
*/

exports.getFullCollectionByType = function(state, type, owner, cb)
{
	var collection = null;

	async.waterfall(
		[
			function(callback)
			{
				var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : 'IS') + ' ? LIMIT 1';
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
	var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : 'IS') + ' ? LIMIT 1';

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
				var row = data[i];
				row.data = new mithril.core.PropertyMap;
				objects[row.id] = row;
			}

			var query = 'SELECT d.object, d.property, d.type, d.language, d.value FROM obj_object_data AS d JOIN obj_collection_object AS co ON co.object = d.object WHERE co.collection = ?';
			var params = [collectionId];
			state.datasources.db.getMany(query, params, null, callback);
		},
		function(data, callback)
		{
			var len = data.length;
			for (var i=0; i < len; i++)
			{
				var row = data[i];
				if (row.object in objects)
				{
					objects[row.object].data.importOne(row.property, row.type, row.value, row.language);
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

/*
 * not used
 *
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
*/

exports.getActorCollections = function(state, ownerId, fields, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + " WHERE obj_collection.owner = ?" ;
	var params = [ownerId];

	state.datasources.db.getMany(query, params, null, cb);
};


exports.addCollection = function(state, type, slotCount, maxWeight, parentCollection, owner, cb)
{
	var query = 'INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES (?, ?, ?, ?, ?)';
	var params = [type, slotCount, maxWeight, parentCollection, owner];

	state.datasources.db.exec(query, params, null, function(err, info) {
		if (err) return cb(err);

		if (owner)
		{
			state.emit(owner, 'obj.collection.add', { collectionId: info.insertId, collectionType: type, slotCount: slotCount, maxWeight:maxWeight, parentId: parentCollection, owner: owner });
		}

		cb(null, { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentCollection: parentCollection, owner: owner });
	});
};

/*
 * not used
 *
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
*/

/*
 * not used
 *
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
*/

/*
 * not used
 *
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
*/

/*
 * not used
 *
exports.getChildCollections = function(state, collectionId, objOptions, cb)
{
	var query = "SELECT * FROM obj_collection WHERE parent = ?";
	state.datasources.db.getMany(query, [collectionId], null, cb);
};
*/

exports.addObjectToCollection = function(state, objectId, collectionId, options, cb)
{
	// TODO: refactor, contains unsafe code

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
					exports.removeObjectFromCollection(state, objectId, data[i].collection, null);	// TODO: unsafe!!!
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

			var sql = 'INSERT into obj_collection_object (collection, object, slot) VALUES (?, ?, ?)';
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
	var query = "SELECT object, slot FROM obj_collection_object WHERE collection = ? ORDER BY slot";
	state.datasources.db.getMany(query, [collectionId], null, cb);
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
				state.emit(data.owner, 'obj.collection.object.slot.edit', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); //untested
			}

			cb();
		});
	});
};


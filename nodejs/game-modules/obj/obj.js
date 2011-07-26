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
	sync: __dirname + '/usercommands/sync.js',
};


exports.hooks = {
	// chooseObjectCollections returns: [ { id: 3, slot: 5 }, { id: 10 } ]

	chooseObjectCollections: function(state, objectName, cb) { return state.error(null, 'obj.hooks.chooseObjectCollections not defined.', cb); }
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

	var query = 'SELECT id, name, weight FROM obj_class';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(error, classes) {
		if (error) return cb(error);

		// read properties

		query = 'SELECT classId, property, tag, language, type, behavior, value FROM obj_class_data';
		params = [];

		state.datasources.db.getMany(query, params, null, function(error, data) {
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


exports.getAllClassNames = function(matcher)
{
	var names = Object.keys(allClassesMap);
	if (matcher)
	{
		names = names.filter(function(name) { return name.match(matcher); });
	}

	return names;
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
		return objClass.data.getOne(property, language, null, function(prop) { return !behaviors || behaviors.indexOf(prop.meta.behavior) !== -1; });
	}

	return fallback;
};


// objects
// ----------------------------------------------------------------------

exports.getActorObjects = function(state, ownerId, cb)
{
	var query = "SELECT oo.id, oo.name, oo.weight, oo.appliedToObject, oo.creationTime FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object INNER JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id";
	state.datasources.db.getMany(query, [ownerId], null, cb);
};


exports.getActorObject = function(state, ownerId, objectId, cb)
{
	var query = "SELECT oo.id, oo.name, oo.weight, appliedToObject, creationTime FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oo.id = ? AND oc.owner = ? GROUP BY oo.id";

	state.datasources.db.getOne(query, [objectId, ownerId], true, null, cb);
};


exports.addObject = function(state, collections, name, weight, propertyMap, tags, quantity, cb)
{
	// collections: [ { id: 3, slot: 5 }, { id: 10 } ]

	var objectIds = [];
	var objLen = 0;

	if (!quantity) quantity = 1;

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

			// propertyMap.fillRequirements(objClass.data, function(prop) { return prop.meta.behavior === 'copy'; });
			propertyMap.importFromMap(objClass.data, true, tags, function(prop) { return prop.meta.behavior === 'copy'; });
		}
	}

	// store object in DB:

	async.waterfall([
		function(callback)
		{
			// create the object

			var sql = 'INSERT INTO obj_object (name, weight, creationTime) VALUES (?, ?, ?)';

			var count = 0;
			async.whilst(
				function() { return count < quantity; },
				function(subcallback) {
					count++;
					state.datasources.db.exec(sql, [name, weight, mithril.core.time], null, function(error, info) {
						if (!error) objectIds.push(info.insertId);
						subcallback(error);
					});
				},
				callback
			);
		},
		function(callback)
		{
 			objLen = objectIds.length;

			// store properties
			var records = [];
			var params = [];

			var props = propertyMap.getAllFlat();
			var propsLen = props.length;

			for (var j=0; j < objLen; j++)
			{
				var objectId = objectIds[j];

				for (var i=0; i < propsLen; i++)
				{
					var prop = props[i];

					records.push('(?, ?, ?, ?, ?)');
					params.push(objectId, prop.property, prop.language || '', prop.type, prop.value);
				}
			}

			if (records.length > 0)
			{
				var sql = 'INSERT INTO obj_object_data VALUES ' + records.join(', ');
				state.datasources.db.exec(sql, params, null, function(error) { callback(error); });
			}
			else
			{
				callback();
			}
		},
		function(callback)
		{
			// store collection links

			var colLen = collections.length;

			if (colLen == 0)
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

				for (var j=0; j < objLen; j++)
				{
					var objectId = objectIds[j];

					for (var i=0; i < colLen; i++)
					{
						var coll = collections[i];

						records.push('(?, ?, ?)');
						params.push(coll.id);
						params.push(objectId);
						params.push((coll.slot === undefined || j > 0) ? null : coll.slot);		// if multiple instances, then we only save the slot on the first object

						// emit everything that happens to the owner

						ownedCollections.forEach(function(row) {
							if (row.id != coll.id) return;

							// new object

							var obj = {
								id: objectId,
								name: name,
								weight: weight,
								creationTime: mithril.core.time
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

		cb(null, objectIds);
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
	var query = 'SELECT od.object, od.property, od.type, od.value FROM obj_object_data AS od JOIN obj_collection_object AS oc ON oc.object = od.object JOIN obj_collection AS c ON c.id = oc.collection WHERE c.owner = ? AND od.language IN (?, ?) GROUP BY od.object, od.property';
	var params = [ownerId, '', state.language()];

	state.datasources.db.getMany(query, params, null, function(error, results) {
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

			var query = 'SELECT name FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.getOne(query, params, true, null, function(error, row) {
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
	var query = 'SELECT name, appliedToObject, weight, creationTime FROM obj_object WHERE id = ?';
	state.datasources.db.getOne(query, [objectId], false, null, cb);
};


exports.getClassByPropertyValues = function(state, property, values, cb)
{
	// values acts as an OR
	if (!values || values.length < 1)
	{
		return state.error(null, 'No values given for property ' + property + ' in obj.getClassByPropertyValues()', cb);
	}

	var query = 'SELECT oc.id, oc.name, oc.weight FROM obj_class AS oc JOIN obj_class_data AS ocd ON ocd.classId = oc.id WHERE ocd.property = ? AND ocd.value IN (' + values.map(function() { return '?'; }).join(', ') + ') LIMIT 1';
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

			var query = 'SELECT o.id, co.slot, o.appliedToObject, o.weight, o.name, o.creationTime FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? ORDER BY co.slot ASC';
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
	var sql = 'INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES (?, ?, ?, ?, ?)';
	var params = [type, slotCount, maxWeight, parentCollection, owner];

	state.datasources.db.exec(sql, params, null, function(err, info) {
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

	var query = "SELECT owner, slotCount, maxWeight from obj_collection WHERE id = ?";
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function(err, data) {
		if (err) return cb(err);

		var owner     = data.owner;
		var maxWeight = data.maxWeight;
		var slotCount = data.slotCount;
		var slot      = null;
		var removeObjectFromSlot = null;

		async.series([
			function(callback) {
				if (!slotCount) return callback();

				// There is a slotcount, so therefore the object to be added needs to get a slot.
				// If no slot has been specified, the first available slot should be used.
				// If a slot has been specified, any existing object must be removed from that slot. NOTE: this is dangerous, because it may become orphaned!
				// If no slot is available, throw an error

				if (options.slot)
				{

					slot = ~~options.slot;

					if (slot < 1)         return state.error(null, 'Invalid slot: ' + slot, callback);
					if (slot > slotCount) return state.error(null, 'Invalid slot: ' + slot + ', this collection has capacity: ' + slotCount, callback);
				}

				var query = 'SELECT slot, object FROM obj_collection_object WHERE collection = ?';
				var params = [collectionId];

				state.datasources.db.getMapped(query, params, { key: 'slot', value: 'object' }, null, function(error, slots) {
					if (error) return callback(error);

					if (slot)
					{
						if (slots[slot])
						{
							removeObjectFromSlot = slots[slot];
						}
					}
					else
					{
						// detect first available slot

						for (var i=1; i <= slotCount; i++)
						{
							if (i in slots) continue;
							slot = i;
							break;
						}
					}

					if (!slot)
					{
						// collection is full

						return state.error(null, 'Cannot add object to collection ' + collectionId + ' because all its slots are occupied.', callback);
					}

					callback();
				});
			},
			function(callback) {
				if (!removeObjectFromSlot || !slot) return callback();

				// remove the object that is currently occupying this slot from the collection

				exports.removeObjectFromSlot(state, collectionId, slot, owner, callback);
			},
			function(callback) {
				// register the object to this collection

				if (owner)
				{
					state.emit(owner, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: slot });
				}

				var sql = 'INSERT INTO obj_collection_object (collection, object, slot) VALUES (?, ?, ?)';
				var params = [collectionId, objectId, slot];

				state.datasources.db.exec(sql, params, null, callback);
			},
			function(callback) {
				// check if the maxWeight rule of the collection is being broken

				if (!maxWeight) return callback();

				var query = 'SELECT SUM(o.weight) AS weight FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? AND o.weight IS NOT NULL';
				var params = [collectionId];

				state.datasources.db.getOne(query, params, false, null, function(error, row) {
					var totalWeight = ~~row.weight;

					if (totalWeight > maxWeight)
					{
						return state.error(null, 'Max weight enforced on collection ' + collectionId, callback);
					}

					return callback();
				});
			}
		],
		cb);
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

		var sql = "UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?";
		params = [slotNumber, collectionId, objectId];

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			if (data.owner)
			{
				state.emit(data.owner, 'obj.collection.object.slot.edit', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); //untested
			}

			cb();
		});
	});
};


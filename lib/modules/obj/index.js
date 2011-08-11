var mithril = require('../../mithril'),
    async = require('async');


var joins = {
	collectionOwner:  { sql: 'LEFT JOIN actor AS ? ON obj_collection.owner = ?.id' },
	collectionObject: { sql: 'JOIN obj_collection_object AS ? ON obj_collection.id = ?.collection' },
	object:           { sql: 'JOIN obj_object AS ? ON collectionObject.object = ?.id', requires: ['collectionObject'] },
	objectData:       { sql: 'JOIN obj_object_data AS ? ON object.id = ?.object', requires: ['object'] }
};

var allowedFields = {
	collectionId:       'id',
	ownerId:            'owner',
	parentId:           'parent',
	collectionType:     'type',
	slotCount:          'slotCount',
	maxWeight:          'maxWeight',
	ownerName:          ['collectionOwner', 'name'],
	objectName:         ['object', 'name'],
	objectWeight:       ['object', 'weight'],
	objectId:           ['object', 'id'],
	propertyName:       ['objectData', 'property'],
	propertyValue:      ['objectData', 'value']
};


exports.hooks = {
	// chooseObjectCollections returns: [ { id: 3, slot: 5 }, { id: 10 } ]

	chooseObjectCollections: function (state, objectName, cb) {
		return state.error(null, 'obj.hooks.chooseObjectCollections not defined.', cb);
	}
};


var allClassesMap = {};
var allClassesArr = [];


exports.setup = function (state, cb) {
	exports.loadAllClasses(state, function (error, classesArr) {
		if (error) {
			return cb(error);
		}

		allClassesArr = classesArr;

		classesArr.forEach(function (objClass) {
			allClassesMap[objClass.name] = objClass;
		});

		cb();
	});
};


// object class definitions
// ----------------------------------------------------------------------

exports.loadAllClasses = function (state, cb) {
	// returns full class definitions, in all languages, all tags

	var query = 'SELECT id, name, weight FROM obj_class';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (error, classes) {
		if (error) {
			return cb(error);
		}

		// read properties

		var query = 'SELECT classId, property, tag, language, type, behavior, value FROM obj_class_data';
		var params = [];

		state.datasources.db.getMany(query, params, null, function (error, data) {
			if (error) {
				return cb(error);
			}

			var clen = classes.length;
			var dlen = data.length;

			for (var i = 0; i < clen; i++) {
				var objClass = classes[i];

				objClass.data = new mithril.core.PropertyMap();

				for (var j = 0; j < dlen; j++) {
					var row = data[j];

					if (row.classId === objClass.id) {
						objClass.data.importOne(row.property, row.type, row.value, row.language, row.tag, { behavior: row.behavior });
					}
				}
			}

			cb(null, classes);
		});
	});
};


exports.getAllClassNames = function (matcher) {
	var names = Object.keys(allClassesMap);

	if (matcher) {
		names = names.filter(function (name) {
			return name.match(matcher);
		});
	}

	return names;
};


exports.getAllClasses = function (language, behaviors) {
	if (!language) {
		return allClassesMap;
	}

	var out = {};
	var fnFilter = null;

	if (behaviors) {
		fnFilter = function (prop) {
			return behaviors.indexOf(prop.meta.behavior) !== -1;
		};
	}

	for (var i = 0, len = allClassesArr.length; i < len; i++) {
		var objClass = allClassesArr[i];

		var outObj = {};

		if (objClass.weight !== null) {
			outObj.weight = objClass.weight;
		}

		if (objClass.data) {
			outObj.data = objClass.data.getAll(language, null, fnFilter);
		}

		out[objClass.name] = outObj;
	}

	return out;
};


exports.getClass = function (className) {
	return allClassesMap[className] || false;
};


exports.getClassProperty = function (className, property, language, tags, behaviors, fallback) {
	var objClass = allClassesMap[className];

	if (objClass && objClass.data) {
		var fnFilter = null;

		if (behaviors) {
			fnFilter = function (prop) {
				return behaviors.indexOf(prop.meta.behavior) !== -1;
			};
		}

		return objClass.data.getOne(property, language, null, fnFilter, fallback);
	}

	return fallback;
};


// objects
// ----------------------------------------------------------------------

exports.getActorObjects = function (state, ownerId, cb) {
	var query = "SELECT oo.id, oo.name, oo.weight, oo.appliedToObject, oo.creationTime FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object INNER JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id";
	var params = [ownerId];

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getActorObject = function (state, ownerId, objectId, cb) {
	var query = "SELECT oo.id, oo.name, oo.weight, appliedToObject, creationTime FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oo.id = ? AND oc.owner = ? GROUP BY oo.id";
	var params = [objectId, ownerId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.addObject = function (state, collections, name, weight, propertyMap, tags, quantity, cb) {
	// collections: [ { id: 3, slot: 5 }, { id: 10 } ]

	var objectIds = [];
	var creationTime = mithril.core.time;

	quantity = quantity || 1;

	// check class definition for "name", so that if it exists, we can apply its logic to this new object

	var objClass = allClassesMap[name];
	if (objClass) {
		if (!weight && weight !== 0) {
			weight = objClass.weight;
		}

		if (objClass.data) {
			// augment data with class data

			propertyMap.importFromMap(objClass.data, true, tags, function (prop) {
				return prop.meta.behavior === 'copy';
			});
		}
	}

	// store object in DB:

	async.waterfall([
		function (callback) {
			// create the objects

			var sql = 'INSERT INTO obj_object (name, weight, creationTime) VALUES (?, ?, ?)';
			var params = [name, weight, creationTime];

			var count = 0;

			async.whilst(
				function () {
					return count < quantity;
				},
				function (subcallback) {
					count++;

					state.datasources.db.exec(sql, params, null, function (error, info) {
						if (error) {
							return subcallback(error);
						}

						objectIds.push(~~info.insertId);

						subcallback();
					});
				},
				callback
			);
		},
		function (callback) {
			// store properties
			var records = [];
			var params = [];

			var props = propertyMap.getAllFlat();
			var propsLen = props.length;

			for (var j = 0, objLen = objectIds.length; j < objLen; j++) {
				var objectId = objectIds[j];

				for (var i = 0; i < propsLen; i++) {
					var prop = props[i];

					records.push('(?, ?, ?, ?, ?)');
					params.push(objectId, prop.property, prop.language || '', prop.type, prop.value);
				}
			}

			if (records.length > 0) {
				var sql = 'INSERT INTO obj_object_data VALUES ' + records.join(', ');

				state.datasources.db.exec(sql, params, null, function (error) {
					callback(error);
				});
			} else {
				callback();
			}
		},
		function (callback) {
			// store collection links

			var colLen = collections.length;

			if (colLen === 0) {
				return callback();
			}

			var db = state.datasources.db;

			var sql = 'SELECT c.id, c.owner, p.language FROM obj_collection AS c JOIN player AS p ON p.actor = c.owner WHERE c.id IN (' + db.getPlaceHolders(collections.length) + ')';
			var params = collections.map(function (coll) {
				return coll.id;
			});

			state.datasources.db.exec(sql, params, null, function (error, ownedCollections) {
				if (error) {
					return callback(error);
				}

				var records = [];
				var params = [];

				for (var j = 0, objLen = objectIds.length; j < objLen; j++) {
					var objectId = objectIds[j];

					for (var i = 0; i < colLen; i++) {
						var coll = collections[i];

						records.push('(?, ?, ?)');
						params.push(coll.id);
						params.push(objectId);
						params.push((coll.slot === undefined || j > 0) ? null : coll.slot);		// if multiple instances, then we only save the slot on the first object

						// emit everything that happens to the owner

						for (var c = 0, clen = ownedCollections.length; c < clen; c++) {
							var row = ownedCollections[c];

							if (row.id !== coll.id) {
								return;
							}

							// new object

							var obj = {
								id: objectId,
								name: name,
								weight: weight,
								creationTime: creationTime
							};

							if (propertyMap) {
								obj.data = propertyMap.getAll(row.language);
							}

							state.emit(row.owner, 'obj.object.add', obj);

							// collection/object link

							var co = { objectId: objectId, collectionId: coll.id };

							if (coll.slot !== undefined && coll.slot !== null) {
								co.slot = coll.slot;
							}

							state.emit(row.owner, 'obj.collection.object.add', co);
						}
					}
				}

				if (records.length > 0) {
					var sql = 'INSERT INTO obj_collection_object VALUES ' + records.join(', ');
					state.datasources.db.exec(sql, params, null, callback);
				} else {
					callback();
				}
			});
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, objectIds);
	});
};


exports.applyObjectToObject = function (state, objectId, applyToObjectId, cb) {
	exports.getObjectOwners(state, objectId, function (error, ownerData) {
		if (error) {
			return cb(error);
		}

		var sql = 'UPDATE obj_object SET appliedToObject = ? WHERE id = ?';
		var params = [applyToObjectId, objectId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = ownerData.length; i < len; i++) {
				state.emit(ownerData[i].owner, 'obj.object.appliedToObjectId.edit', { id: objectId, to: applyToObjectId }); // TODO: test this!
			}

			cb();
		});
	});
};


/*
 * not used yet
exports.detachObjectFromObject = function (state, objectId, cb) {
	exports.getObjectOwners(state, objectId, function (err, ownerData) {
		if (err) return cb(err);

		var sql = 'UPDATE obj_object SET appliedToObject = NULL WHERE id = ?';
		var params = [objectId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) return cb(error);

			var len = ownerData.length;
			for (var i = 0; i < len; i++) {
				state.emit(ownerData[i].owner, 'obj.object.edit', { id: objectId, property: 'appliedToObjectId', to: null }); //untested
			}

			cb();
		});
	});
};
*/


exports.detachObjectChildren = function (state, objectId, cb) {
	// TODO: IMPLEMENT

	// notify all owners about the detaching

	cb();
};



exports.getObjectProperty = function (state, objectId, property, fallback, cb) {
	var query = 'SELECT o.name, od.type, od.value FROM obj_object AS o LEFT JOIN obj_object_data AS od ON od.object = o.id AND od.property = ? AND od.language IN (?, ?) WHERE o.id = ?';
	var params = [property, '', state.language(), objectId];

	state.datasources.db.getOne(query, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		if (row) {
			if (row.value !== null) {
				return cb(null, mithril.core.PropertyMap.unserialize(row.type, row.value));
			}

			// check if the object's class has this property defined as inherit

			var value = exports.getClassProperty(row.name, property, state.language(), null, ['inherit'], fallback);

			return cb(null, value);
		}

		return cb(null, fallback);
	});
};


exports.getObjectDataByOwner = function (state, ownerId, cb) {
	var query = 'SELECT od.object, od.property, od.type, od.value FROM obj_object_data AS od JOIN obj_collection_object AS oc ON oc.object = od.object JOIN obj_collection AS c ON c.id = oc.collection WHERE c.owner = ? AND od.language IN (?, ?) GROUP BY od.object, od.property';
	var params = [ownerId, '', state.language()];

	state.datasources.db.getMany(query, params, null, function (error, results) {
		var props = [];

		for (var i = 0, len = results.length; i < len; i++) {
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


exports.setObjectData = function (state, objectId, propertyMap, requiredOwnerId, cb) {
	var requireClassProperties = propertyMap.hasRequirements();

	var name = null;
	var objClass = null;
	var owners = null;

	requiredOwnerId = ~~requiredOwnerId;

	async.series([
		function (callback) {
			if (!requireClassProperties) {
				return callback();
			}

			// augment data object with "copy" style class properties

			var query = 'SELECT name FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.getOne(query, params, true, null, function (error, row) {
				if (error) {
					return callback(error);
				}

				name = row.name;
				objClass = allClassesMap[name];

				if (objClass.data) {
					var filled = propertyMap.fillRequirements(objClass.data, function (prop) {
						return !prop.meta || prop.meta.behavior === 'copy';
					});

					if (!filled) {
						return state.error(null, 'Filling object property requirements failed.', callback);
					}
				}

				callback();
			});
		},
		function (callback) {
			exports.getObjectOwners(state, objectId, function (error, results) {
				if (error) {
					return callback(error);
				}

				owners = results;

				if (requiredOwnerId) {
					var validOwner = owners.some(function (ownerData) {
						return ownerData.owner === requiredOwnerId;
					});

					if (!validOwner) {
						return state.error(null, 'Actor ' + requiredOwnerId + ' does not own object ' + objectId + ', so cannot change properties.', callback);
					}
				}

				callback();
			});
		},
		function (callback) {
			var sql = 'INSERT INTO obj_object_data VALUES ';

			var values = [];
			var params = [];

			var props = propertyMap.getAllFlat();

			for (var i = 0, len = props.length; i < len; i++) {
				var prop = props[i];

				values.push('(?, ?, ?, ?, ?)');
				params.push(objectId, prop.property, prop.language || '', prop.type, prop.value);
			}

			sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

			state.datasources.db.exec(sql, params, null, function (err) {
				if (err) {
					return cb(err);
				}

				for (var i = 0, len = owners.length; i < len; i++) {
					var owner = owners[i];

					state.emit(owner.owner, 'obj.object.data.edit', { objectId: objectId, data: propertyMap.getAll(owner.language) });
				}

				cb();
			});
		}
	],
	cb);
};


exports.delObjectData = function (state, objectId, properties, requiredOwnerId, cb) {
	exports.getObjectOwners(state, objectId, function (error, owners) {
		if (error) {
			return cb(error);
		}

		if (requiredOwnerId) {
			var validOwner = owners.some(function (ownerData) {
				return ownerData.owner === requiredOwnerId;
			});

			if (!validOwner) {
				return state.error(null, 'Actor ' + requiredOwnerId + ' does not own object ' + objectId + ', so cannot change properties.', cb);
			}
		}

		var db = state.datasources.db;

		var sql = 'DELETE FROM obj_object_data WHERE object = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
		var params = [objectId].concat(properties);

		db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = owners.length; i < len; i++) {
				state.emit(owners[i].owner, 'obj.object.data.del', { objectId: objectId, properties: properties });
			}

			cb();
		});
	});
};


exports.delObject = function (state, objectId, cb) {
	exports.getObjectOwners(state, objectId, function (error, owners) {
		if (error) {
			return cb(error);
		}

		// detach all attached objects

		exports.detachObjectChildren(state, objectId, function (error) {
			if (error) {
				return cb(error);
			}

			// notify all owners

			owners.forEach(function (row) {
				state.emit(row.owner, 'obj.object.del', { objectId: objectId });
			});

			// remove the object from the DB

			var sql = 'DELETE FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.exec(sql, params, null, function (error) {
				cb(error);
			});
		});
	});
};


exports.getObjectOwners = function (state, objectId, cb) {
	var query = 'SELECT DISTINCT oc.owner FROM obj_collection AS oc JOIN obj_collection_object AS oco ON oc.id = oco.collection WHERE oco.object = ?';
	var params = [objectId];

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getObjectById = function (state, objectId, cb) {
	var query = 'SELECT name, appliedToObject, weight, creationTime FROM obj_object WHERE id = ?';
	var params = [objectId];

	state.datasources.db.getOne(query, params, false, null, cb);
};


exports.getClassByPropertyValues = function (state, property, values, cb) {
	// values acts as an OR

	if (!values || values.length === 0) {
		return state.error(null, 'No values given for property ' + property + ' in obj.getClassByPropertyValues()', cb);
	}

	var db = state.datasources.db;

	var query = 'SELECT oc.id, oc.name, oc.weight FROM obj_class AS oc JOIN obj_class_data AS ocd ON ocd.classId = oc.id WHERE ocd.property = ? AND ocd.value IN (' + db.getPlaceHolders(values.length) + ') LIMIT 1';
	var params = [property].concat(values);

	db.getOne(query, params, false, null, cb);
};



// object collections
// ----------------------------------------------------------------------

exports.getFullCollectionByType = function (state, type, owner, cb) {
	var collection = null;

	async.waterfall(
		[
			function (callback) {
				var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : 'IS') + ' ? LIMIT 1';
				var params = [type, owner];

				state.datasources.db.getOne(query, params, true, null, callback);
			},
			function (result, callback) {
				exports.getFullCollection(state, result.id, callback);
			},
			function (coll, callback) {
				collection = coll;
				callback();
			}
		],
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, collection);
		}
	);
};


exports.getCollectionIdByType = function (state, type, owner, cb) {
	var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner !== null ? '=' : 'IS') + ' ? LIMIT 1';
	var params = [type, owner];

	state.datasources.db.getOne(query, params, true, null, function (error, collection) {
		if (error) {
			return cb(error);
		}

		cb(null, collection.id);
	});
};


exports.getFullCollection = function (state, collectionId, cb) {
	var collection = null;
	var objects = {};	// quick object ID based lookup

	async.waterfall(
		[
			function (callback) {
				var query = 'SELECT parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?';
				var params = [collectionId];

				state.datasources.db.getOne(query, params, true, null, callback);
			},
			function (data, callback) {
				collection = data;
				collection.id = collectionId;

				var query = 'SELECT o.id, co.slot, o.appliedToObject, o.weight, o.name, o.creationTime FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? ORDER BY co.slot ASC';
				var params = [collectionId];

				state.datasources.db.getMany(query, params, null, callback);
			},
			function (data, callback) {
				collection.objects = data;

				for (var i = 0, len = data.length; i < len; i++) {
					var row = data[i];

					row.data = new mithril.core.PropertyMap();
					objects[row.id] = row;
				}

				var query = 'SELECT d.object, d.property, d.type, d.language, d.value FROM obj_object_data AS d JOIN obj_collection_object AS co ON co.object = d.object WHERE co.collection = ?';
				var params = [collectionId];

				state.datasources.db.getMany(query, params, null, callback);
			},
			function (data, callback) {
				for (var i = 0, len = data.length; i < len; i++) {
					var row = data[i];
					var obj = objects[row.object];

					if (obj) {
						obj.data.importOne(row.property, row.type, row.value, row.language);
					}
				}
				callback();
			}
		],
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, collection);
		}
	);
};


exports.getActorCollections = function (state, ownerId, fields, cb) {
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'obj_collection', joins) + ' WHERE obj_collection.owner = ?';
	var params = [ownerId];

	state.datasources.db.getMany(query, params, null, cb);
};


exports.addCollection = function (state, type, slotCount, maxWeight, parentCollection, owner, cb) {
	var sql = 'INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES (?, ?, ?, ?, ?)';
	var params = [type, slotCount, maxWeight, parentCollection, owner];

	state.datasources.db.exec(sql, params, null, function (err, info) {
		if (err) {
			return cb(err);
		}

		if (owner) {
			state.emit(owner, 'obj.collection.add', { collectionId: info.insertId, collectionType: type, slotCount: slotCount, maxWeight: maxWeight, parentId: parentCollection, owner: owner });
		}

		cb(null, { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentCollection: parentCollection, owner: owner });
	});
};


exports.addObjectToCollection = function (state, objectId, collectionId, options, cb) {
	options = options || {};

	var query = 'SELECT owner, slotCount, maxWeight from obj_collection WHERE id = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function (err, data) {
		if (err) {
			return cb(err);
		}

		var owner     = data.owner;
		var maxWeight = data.maxWeight;
		var slotCount = data.slotCount;
		var slot      = null;
		var removeObjectFromSlot = null;

		async.series([
			function (callback) {
				if (!slotCount) {
					return callback();
				}

				// There is a slotcount, so therefore the object to be added needs to get a slot.
				// If no slot has been specified, the first available slot should be used.
				// If a slot has been specified, any existing object must be removed from that slot. NOTE: this is dangerous, because it may become orphaned!
				// If no slot is available, throw an error

				if (options.slot)
				{
					slot = ~~options.slot;

					if (slot < 1) {
						return state.error(null, 'Invalid slot: ' + slot, callback);
					}

					if (slot > slotCount) {
						return state.error(null, 'Invalid slot: ' + slot + ', this collection has capacity: ' + slotCount, callback);
					}
				}

				var query = 'SELECT slot, object FROM obj_collection_object WHERE collection = ?';
				var params = [collectionId];

				state.datasources.db.getMapped(query, params, { key: 'slot', value: 'object' }, null, function (error, slots) {
					if (error) {
						return callback(error);
					}

					if (slot) {
						if (slots[slot]) {
							removeObjectFromSlot = slots[slot];
						}
					} else {
						// detect first available slot

						for (var i = 1; i <= slotCount; i++) {
							if (!(i in slots)) {
								slot = i;
								break;
							}
						}
					}

					if (!slot) {
						// collection is full

						return state.error(null, 'Cannot add object to collection ' + collectionId + ' because all its slots are occupied.', callback);
					}

					callback();
				});
			},
			function (callback) {
				if (!removeObjectFromSlot || !slot) {
					return callback();
				}

				// remove the object that is currently occupying this slot from the collection

				exports.removeObjectFromSlot(state, collectionId, slot, owner, callback);
			},
			function (callback) {
				// register the object to this collection

				if (owner) {
					state.emit(owner, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: slot });
				}

				var sql = 'INSERT INTO obj_collection_object (collection, object, slot) VALUES (?, ?, ?)';
				var params = [collectionId, objectId, slot];

				state.datasources.db.exec(sql, params, null, callback);
			},
			function (callback) {
				// check if the maxWeight rule of the collection is being broken

				if (!maxWeight) {
					return callback();
				}

				var query = 'SELECT SUM(o.weight) AS weight FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? AND o.weight IS NOT NULL';
				var params = [collectionId];

				state.datasources.db.getOne(query, params, false, null, function (error, row) {
					var totalWeight = ~~row.weight;

					if (totalWeight > maxWeight) {
						return state.error(null, 'Max weight enforced on collection ' + collectionId, callback);
					}

					return callback();
				});
			}
		],
		cb);
	});
};


exports.removeObjectFromCollection = function (state, objectId, collectionId, requiredOwner, cb) {
	var query = 'SELECT owner from obj_collection WHERE id = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function (err, data) {
		if (err) {
			return cb(err);
		}

		if (requiredOwner && data.owner !== requiredOwner) {
			return state.error(null, 'Actor ' + requiredOwner + ' tried to remove object from collection ' + collectionId + ', which is owned by actor ' + data.owner + '.', cb);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE object = ? AND collection = ?';
		var params = [objectId, collectionId];

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			if (data.owner && info.affectedRows > 0) {
				state.emit(data.owner, 'obj.collection.object.del', { objectId: objectId, collectionId: collectionId });
			}

			cb();
		});
	});
};


exports.removeObjectFromSlot = function (state, collectionId, slot, requiredOwner, cb) {
	var query = 'SELECT owner from obj_collection WHERE id = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function (err, data) {
		if (err) {
			return cb(err);
		}

		if (requiredOwner && data.owner !== requiredOwner) {
			return state.error(null, 'Actor ' + requiredOwner + ' tried to remove object from collection ' + collectionId + ', which is owned by actor ' + data.owner + '.', cb);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE collection = ? AND slot = ?';
		var params = [collectionId, slot];

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			if (data.owner && info.affectedRows > 0) {
				state.emit(data.owner, 'obj.collection.object.del', { collectionId: collectionId, slot: slot }); // TODO: test!
			}

			cb();
		});
	});
};


exports.getCollectionMembers = function (state, collectionId, cb) {
	var query = 'SELECT object, slot FROM obj_collection_object WHERE collection = ? ORDER BY slot ASC';
	var params = [collectionId];

	state.datasources.db.getMany(query, params, null, cb);
};


exports.setObjectSlot = function (state, objectId, collectionId, slotNumber, cb) { // effectively a move within a collection.  may want to add more checks
	var query = 'SELECT owner FROM obj_collection JOIN obj_collection_obj ON obj_collection.id = obj_collection_obj.collection WHERE collectionId = ? AND objectId = ?';
	var params = [collectionId, objectId];

	state.datasources.db.getOne(query, params, true, null, function (err, data) {
		if (err) {
			return cb(err);
		}

		var sql = 'UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?';
		var params = [slotNumber, collectionId, objectId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			if (data.owner) {
				state.emit(data.owner, 'obj.collection.object.slot.edit', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); // TODO: test!
			}

			cb();
		});
	});
};


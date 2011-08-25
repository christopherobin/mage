var mithril = require('../../mithril'),
    async = require('async');


exports.hooks = {
	// chooseObjectCollections returns: [ { id: 3, slot: 5 }, { id: 10 } ]

	chooseObjectCollections: function (state, objectName, cb) {
		return state.error(null, 'obj.hooks.chooseObjectCollections not defined.', cb);
	}
};


// lookup structures

var allCategoriesMap = {};
var allCategoriesArr = [];
var allClassesMap = {};
var allClassesArr = [];


// setup of cached lookup data

function loadAllCategories(state, cb) {
	// loads and caches full category definitions, in all languages

	var sql = 'SELECT id, name FROM obj_category';
	var params = [];

	state.datasources.db.getMany(sql, params, null, function (error, categories) {
		if (error) {
			return cb(error);
		}

		// store the array as a lookup cache

		allCategoriesArr = categories;
		allCategoriesMap = {};

		// load category property data

		var sql = 'SELECT categoryId, property, language, type, value FROM obj_category_data';
		var params = [];

		state.datasources.db.getMany(sql, params, null, function (error, data) {
			if (error) {
				return cb(error);
			}

			var clen = categories.length;
			var dlen = data.length;

			for (var i = 0; i < clen; i++) {
				var category = categories[i];

				// store the class in the by-name lookup cache

				allCategoriesMap[category.name] = category;

				// register the properties on the class

				category.data = new mithril.core.PropertyMap();

				for (var j = 0; j < dlen; j++) {
					var row = data[j];

					if (row.categoryId === category.id) {
						category.data.importOne(row.property, row.type, row.value, row.language);
					}
				}
			}

			cb();
		});
	});
}


function loadAllClasses(state, cb) {
	// loads and caches full class definitions, in all languages, all tags
	// requires categories to already be loaded

	var sql = 'SELECT id, name, weight FROM obj_class';
	var params = [];

	state.datasources.db.getMany(sql, params, null, function (error, classes) {
		if (error) {
			return cb(error);
		}

		// store the array as a lookup cache

		allClassesArr = classes;
		allClassesMap = {};

		// load class property data

		var sql = 'SELECT classId, property, tag, language, type, behavior, value FROM obj_class_data';
		var params = [];

		state.datasources.db.getMany(sql, params, null, function (error, data) {
			if (error) {
				return cb(error);
			}

			var clen = classes.length;
			var dlen = data.length;

			for (var i = 0; i < clen; i++) {
				var objClass = classes[i];

				// prepare the category list

				objClass.categories = [];

				// store the class in the by-name lookup cache

				allClassesMap[objClass.name] = objClass;

				// register the properties on the class

				objClass.data = new mithril.core.PropertyMap();

				for (var j = 0; j < dlen; j++) {
					var row = data[j];

					if (row.classId === objClass.id) {
						objClass.data.importOne(row.property, row.type, row.value, row.language, row.tag, { behavior: row.behavior });
					}
				}
			}

			// load category links

			var sql = 'SELECT cl.name AS className, ca.name AS categoryName FROM obj_class_category AS cc JOIN obj_class AS cl ON cl.id = cc.classId JOIN obj_category AS ca ON ca.id = cc.categoryId';
			var params = [];

			state.datasources.db.getMany(sql, params, null, function (error, rows) {
				if (error) {
					return cb(error);
				}

				for (var i = 0, len = rows.length; i < len; i++) {
					var row = rows[i];

					var objClass = allClassesMap[row.className];
					if (objClass) {
						objClass.categories.push(allCategoriesMap[row.categoryName]);
					}
				}

				cb();
			});
		});
	});
}


exports.setup = function (state, cb) {
	async.series([
		function (callback) {
			loadAllCategories(state, callback);
		},
		function (callback) {
			loadAllClasses(state, callback);
		}
	],
	cb);
};


// fetching data for the sync command

exports.getSyncData = function (state, options, cb) {
	var out = {};

	var language = options.forLanguage || state.language();

	if (options.addClasses) {
		out.classes = exports.getAllClasses(language, ['none', 'inherit'], true);
	}

	if (options.addCategories) {
		out.categories = exports.getAllCategories(language);
	}

	var collectionIds;

	var db = state.datasources.db;

	async.series([
		function (callback) {
			// load base collection list

			if (!options.addCollections) {
				return callback();
			}

			out.collections = {};

			// SELECT c.id, c.parent AS parentId, c.type, c.slotCount, c.maxWeight, c.owner FROM obj_collection AS c LEFT JOIN obj_collection_observer AS co ON co.collectionId = c.id AND co.actorId = 1 WHERE c.owner = 1 OR co.actorId IS NOT NULL

			var sql = 'SELECT c.id, c.parent AS parentId, c.type, c.slotCount, c.maxWeight, c.owner FROM obj_collection AS c';
			var where = [];
			var params = [];

			if (options.actorId) {
				sql += ' LEFT JOIN obj_collection_observer AS co ON co.collectionId = c.id AND co.actorId = ?';
				where.push('? IN (c.owner, co.actorId)');

				params.push(options.actorId, options.actorId);
			}

			if (options.collectionIds) {
				where.push('c.id IN (' + db.getPlaceHolders(options.collectionIds.length) + ')');
				params = params.concat(options.collectionIds);
			}

			if (where.length === 0) {
				return state.error(null, 'Cannot do an obj data sync without any filtering.', cb);
			}

			sql += ' WHERE ' + where.join(' AND ');

			db.getMany(sql, params, null, function (error, rows) {
				if (error) {
					return callback(error);
				}

				if (rows.length === 0) {
					return callback();
				}

				collectionIds = [];

				for (var i = 0, len = rows.length; i < len; i++) {
					var coll = rows[i];

					collectionIds.push(coll.id);

					// drop unused properties for short transport

					if (!coll.parentId) {
						delete coll.parentId;
					}

					if (!coll.slotCount) {
						delete coll.slotCount;
					}

					if (!coll.maxWeight) {
						delete coll.maxWeight;
					}

					coll.members = [];	// object link data

					out.collections[coll.id] = coll;
				}

				// load all collection-object links

				var sql = 'SELECT collection, object AS id, slot FROM obj_collection_object WHERE collection IN (' + db.getPlaceHolders(collectionIds.length) + ')';
				var params = [].concat(collectionIds);

				db.getMany(sql, params, null, function (error, rows) {
					if (error) {
						return callback(error);
					}

					for (var i = 0, len = rows.length; i < len; i++) {
						var member = rows[i];

						if (member.slot === null) {
							delete member.slot;
						}

						var collectionId = member.collection;
						delete member.collection;

						out.collections[collectionId].members.push(member);
					}

					callback();
				});
			});
		},
		function (callback) {
			// load all full objects in these collections

			if (!options.addObjects) {
				return callback();
			}

			var sql, params;

			if (options.objectIds) {
				sql = 'SELECT id, name, weight, appliedToObject, creationTime FROM obj_object WHERE id IN (' + db.getPlaceHolders(options.objectIds.length) + ')';
				params = [].concat(options.objectIds);
			} else {
				sql = 'SELECT o.id, o.name, o.weight, o.appliedToObject, o.creationTime FROM obj_object AS o JOIN obj_collection_object AS co ON o.id = co.object WHERE co.collection IN (' + db.getPlaceHolders(collectionIds.length) + ') GROUP BY o.id';
				params = [].concat(collectionIds);
			}

			db.getMany(sql, params, null, function (error, rows) {
				if (error) {
					return callback(error);
				}

				out.objects = rows;

				var objectMap = {};

				for (var i = 0, len = rows.length; i < len; i++) {
					var o = rows[i];

					// drop unused properties for short transport

					if (!o.appliedToObject) {
						delete o.appliedToObject;
					}

					if (!o.weight) {
						delete o.weight;
					}

					objectMap[o.id] = o;
				}

				// load all object data

				var sql, params;

				if (options.objectIds) {
					sql = 'SELECT object, property, type, value FROM obj_object_data WHERE language IN (?, ?) AND object IN (' + db.getPlaceHolders(options.objectIds.length) + ') GROUP BY object, property';
					params = ['', language].concat(options.objectIds);
				} else {
					sql = 'SELECT od.object, od.property, od.type, od.value FROM obj_object_data AS od JOIN obj_collection_object AS co ON co.object = od.object WHERE od.language IN (?, ?) AND co.collection IN (' + db.getPlaceHolders(collectionIds.length) + ') GROUP BY od.object, od.property';
					params = ['', language].concat(collectionIds);
				}

				db.getMany(sql, params, null, function (error, rows) {
					if (error) {
						return callback(error);
					}

					var props = [];

					for (var i = 0, len = rows.length; i < len; i++) {
						var row = rows[i];

						var o = objectMap[row.object];
						if (o) {
							o.data = o.data || {};
							o.data[row.property] = mithril.core.PropertyMap.unserialize(row.type, row.value);
						}
					}

					callback();
				});
			});
		}
	],
	function (error) {
		// yield results

		if (error) {
			return cb(error);
		}

		cb(null, out);
	});
};


// category definitions
// ----------------------------------------------------------------------

exports.getAllCategories = function (language) {
	if (!language) {
		return allCategoriesMap;
	}

	var out = [];

	for (var i = 0, len = allCategoriesArr.length; i < len; i++) {
		var category = allCategoriesArr[i];

		var outObj = { id: category.id, name: category.name };

		if (category.data) {
			outObj.data = category.data.getAll(language);
		}

		out.push(outObj);
	}

	return out;
};


// object class definitions
// ----------------------------------------------------------------------

exports.getAllClassNames = function (matcher) {
	var names = Object.keys(allClassesMap);

	if (matcher) {
		names = names.filter(function (name) {
			return name.match(matcher);
		});
	}

	return names;
};


exports.getAllClasses = function (language, behaviors, useCategoryIds) {
	if (!language && !behaviors && !useCategoryIds) {
		return allClassesMap;
	}

	var out = {};
	var fnFilter = null;

	if (behaviors) {
		fnFilter = function (prop) {
			return behaviors.indexOf(prop.meta.behavior) !== -1;
		};
	}

	var getId = function (category) {
		return category.id;
	};

	for (var i = 0, len = allClassesArr.length; i < len; i++) {
		var objClass = allClassesArr[i];

		var outObj = {};

		if (objClass.weight !== null) {
			outObj.weight = objClass.weight;
		}

		if (objClass.data) {
			outObj.data = objClass.data.getAll(language, null, fnFilter);
		}

		if (objClass.categories.length > 0) {
			outObj.categories = objClass.categories.map(getId);
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


// observers
// ----------------------------------------------------------------------

exports.addCollectionObserver = function (state, collectionId, actorId, cb) {
	// adds an observer to a collection

	var sql = 'INSERT IGNORE INTO obj_collection_observer VALUES (?, ?)';
	var params = [collectionId, actorId];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		exports.getSyncData(state, { collectionIds: [collectionId], addCollections: true, addObjects: true }, function (error, data) {
			if (error) {
				return cb(error);
			}

			state.emit(actorId, 'obj.collections.sync', data);

			cb();
		});
	});
};


exports.delCollectionObserver = function (state, collectionId, actorId, cb) {
	// removes an observer from a collection

	var sql = 'DELETE FROM obj_collection_observer WHERE collectionId = ? AND actorId = ?';
	var params = [collectionId, actorId];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(actorId, 'obj.collections.desync', { collectionIds: [collectionId] });

		cb();
	});
};


exports.getObjectActors = function (state, objectId, options, cb) {
	// retrieve all collectionIds for this object

	var sql = 'SELECT collection FROM obj_collection_object WHERE object = ?';
	var params = [objectId];

	state.datasources.db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var collectionIds = [];

		for (var i = 0, len = rows.length; i < len; i++) {
			collectionIds.push(rows[i].collection);
		}

		exports.getCollectionsActors(state, collectionIds, options, cb);
	});
};


exports.getCollectionsActors = function (state, collectionIds, options, cb) {
	options = options || {};

	var db = state.datasources.db;

	var sql = [], params = [];
	var placeHolders = db.getPlaceHolders(collectionIds.length);

	if (options.includeLanguage) {
		// create queries with language feedback

		if (options.owners) {
			sql.push("SELECT DISTINCT c.owner AS actorId, 'owner' AS role, p.language FROM obj_collection AS c JOIN player AS p ON p.actor = c.owner WHERE c.id IN (" + placeHolders + ")");
			params = params.concat(collectionIds);
		}

		if (options.observers) {
			sql.push("SELECT DISTINCT o.actorId, 'observer' AS role, p.language FROM obj_collection_observer AS o JOIN player AS p ON p.actor = o.actorId WHERE o.collectionId IN (" + placeHolders + ")");
			params = params.concat(collectionIds);
		}
	} else {
		// create queries without language feedback

		if (options.owners) {
			sql.push("SELECT DISTINCT owner AS actorId, 'owner' AS role FROM obj_collection WHERE id IN (" + placeHolders + ")");
			params = params.concat(collectionIds);
		}

		if (options.observers) {
			sql.push("SELECT DISTINCT actorId, 'observer' AS role FROM obj_collection_observer WHERE collectionId IN (" + placeHolders + ")");
			params = params.concat(collectionIds);
		}
	}

	sql = sql.join(' UNION ');

	db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		// drop duplicates

		var result = [];
		var foundActorIds = [];
		var foundRequiredOwner = (options.mustContainOwnerId ? false : true);	// set to true if we don't need an owner to be found

		for (var i = 0, len = rows.length; i < len; i++) {
			var row = rows[i];

			// { actorId: .., role: ['owner' or 'observer'], language: 'EN' }

			// check if the required owner is mentioned

			if (row.actorId === options.mustContainOwnerId && row.role === 'owner') {
				foundRequiredOwner = true;
			}

			// add to the unique list of actors

			if (foundActorIds.indexOf(row.actorId) === -1) {
				foundActorIds.push(row.actorId);
				result.push(row);
			}
		}

		if (!foundRequiredOwner) {
			return state.error(null, 'Required owner ' + options.mustContainOwnerId + ' not found in the group of owner/observers.', cb);
		}

		var db = state.datasources.db;
		if (options.full || options.includeLanguage) {
			cb(null, result);
		} else {
			cb(null, foundActorIds);
		}
	});
};


// objects
// ----------------------------------------------------------------------

exports.getActorObjects = function (state, ownerId, cb) {
	var query = 'SELECT oo.id, oo.name, oo.weight, oo.appliedToObject, oo.creationTime FROM obj_object AS oo INNER JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oc.owner = ? GROUP BY oo.id';
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

					state.datasources.db.exec(sql, [].concat(params), null, function (error, info) {
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
	exports.getObjectActors(state, objectId, { owners: true, observers: true }, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		var sql = 'UPDATE obj_object SET appliedToObject = ? WHERE id = ?';
		var params = [applyToObjectId, objectId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			state.emitToActors(actorIds, 'obj.object.appliedToObjectId.edit', { id: objectId, to: applyToObjectId });

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
	var actors = null;

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
			exports.getObjectActors(state, objectId, { owners: true, observers: true, includeLanguage: true, mustContainOwnerId: requiredOwnerId }, function (error, result) {
				if (error) {
					return callback(error);
				}

				actors = result;

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

				for (var i = 0, len = actors.length; i < len; i++) {
					var actor = actors[i];

					state.emit(actor.actorId, 'obj.object.data.edit', { objectId: objectId, data: propertyMap.getAll(actor.language) });
				}

				cb();
			});
		}
	],
	cb);
};


exports.delObjectData = function (state, objectId, properties, requiredOwnerId, cb) {
	exports.getObjectActors(state, objectId, { owners: true, observers: true, full: true, mustContainOwnerId: requiredOwnerId }, function (error, actors) {
		if (error) {
			return cb(error);
		}

		var db = state.datasources.db;

		var sql = 'DELETE FROM obj_object_data WHERE object = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
		var params = [objectId].concat(properties);

		db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = actors.length; i < len; i++) {
				state.emit(actors[i].actorId, 'obj.object.data.del', { objectId: objectId, properties: properties });
			}

			cb();
		});
	});
};


exports.delObject = function (state, objectId, cb) {
	exports.getObjectActors(state, objectId, { owners: true, observers: true }, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		// detach all attached objects

		exports.detachObjectChildren(state, objectId, function (error) {
			if (error) {
				return cb(error);
			}

			// notify all actors

			state.emitToActors(actorIds, 'obj.object.del', { objectId: objectId });

			// remove the object from the DB

			var sql = 'DELETE FROM obj_object WHERE id = ?';
			var params = [objectId];

			state.datasources.db.exec(sql, params, null, function (error) {
				cb(error);
			});
		});
	});
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


exports.editCollection = function (state, collectionId, options, replacement, cb) {
	collectionId = ~~collectionId;
	options = options || {};

	var newData, fnReplace;

	if (typeof replacement === 'function') {
		fnReplace = replacement;
	} else {
		newData = replacement;
	}

	// if replacement is a function, read the current collection information, and have the function mutate it before writing

	if (fnReplace) {

		var sql = 'SELECT type, slotCount, maxWeight FROM obj_collection WHERE id = ?';
		var params = [collectionId];

		state.datasources.db.getOne(sql, params, false, null, function (error, row) {
			if (error) {
				return cb(error);
			}

			if (fnReplace) {
				// no data was given, only a callback
				// so we call the callback in order to get new values

				// copy the old collection data for change-comparison

				var key;
				var oldData = {};
				for (key in row) {
					oldData[key] = row[key];
				}

				// ask the fnReplace function to mutate the values

				newData = fnReplace(row);

				// remove unchanged values

				for (key in oldData) {
					var oldValue = oldData[key];
					var newValue = newData[key];

					if (newValue !== undefined && oldValue === newValue) {
						delete newData[key];
					}
				}
			}

			// write newData to database

			exports.editCollection(state, collectionId, options, newData, cb);
		});

		return;
	}

	// replacement is not a function, so we use newData and write those values to DB

	var caOptions = {
		owners: true,
		observers: true
	};

	if (options.requiredOwner) {
		caOptions.mustContainOwnerId = options.requiredOwner;
	}

	exports.getCollectionsActors(state, [collectionId], caOptions, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		var allowedFields = ['type', 'slotCount', 'maxWeight'];

		var sql = 'UPDATE obj_collection SET ';
		var parts = [];
		var params = [];
		var eventData = { id: collectionId };

		for (var i = 0, len = allowedFields.length; i < len; i++) {
			var key = allowedFields[i];
			var value = newData[key];

			if (value !== undefined) {
				parts.push(key + ' = ?');
				params.push(value);
				eventData[key] = value;
			}
		}

		if (parts.length === 0) {
			return cb();
		}

		sql += parts.join(', ') + ' WHERE id = ?';
		params.push(collectionId);

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			if (info.affectedRows === 0) {
				return cb();
			}

			// inform owner and observers

			state.emitToActors(actorIds, 'obj.collection.edit', eventData);
			cb();
		});
	});
};


exports.getTotalCollectionWeight = function (state, collectionId, cb) {
	var sql = 'SELECT SUM(o.weight) AS weight FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? AND o.weight IS NOT NULL';
	var params = [collectionId];

	state.datasources.db.getOne(sql, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		cb(null, ~~row.weight);
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
		var observers;
		var maxWeight = data.maxWeight;
		var slotCount = data.slotCount;
		var slot      = null;
		var removeObjectFromSlot = null;

		async.series([
			function (callback) {
				// load all observers, because besides the owner, we need to notify them as well

				exports.getCollectionsActors(state, [collectionId], { observers: true, includeLanguage: true }, function (error, results) {
					if (error) {
						return callback(error);
					}

					observers = results;

					callback();
				});
			},
			function (callback) {
				if (!slotCount) {
					return callback();
				}

				// There is a slotcount, so therefore the object to be added needs to get a slot.
				// If no slot has been specified, the first available slot should be used.
				// If a slot has been specified, any existing object must be removed from that slot. NOTE: this is dangerous, because it may become orphaned!
				// If no slot is available, throw an error

				if (options.slot) {
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

				var sql = 'INSERT INTO obj_collection_object (collection, object, slot) VALUES (?, ?, ?)';
				var params = [collectionId, objectId, slot];

				state.datasources.db.exec(sql, params, null, callback);
			},
			function (callback) {
				// check if the maxWeight rule of the collection is being broken

				if (!maxWeight) {
					return callback();
				}

				exports.getTotalCollectionWeight(state, collectionId, function (error, totalWeight) {
					if (error) {
						return callback(error);
					}

					if (totalWeight > maxWeight) {
						return state.error(null, 'Max weight enforced on collection ' + collectionId, callback);
					}

					return callback();
				});
			},
			function (callback) {
				// observers need to sync the object, since it may not have been known

				if (!observers) {
					return callback();
				}

				var languages = [];

				for (var i = 0, len = observers.length; i < len; i++) {
					var language = observers[i].language;

					if (languages.indexOf(language) === -1) {
						languages.push(language);
					}
				}

				async.forEachSeries(
					languages,
					function (language, callback2) {
						exports.getSyncData(state, { addObjects: true, objectIds: [objectId], forLanguage: language }, function (error, data) {
							if (error) {
								return callback2(error);
							}

							for (var i = 0, len = observers.length; i < len; i++) {
								var observer = observers[i];

								if (observer.language === language) {
									state.emit(observer.actorId, 'obj.collections.sync', data);
								}
							}

							callback2();
						});
					},
					callback
				);
			},
			function (callback) {
				// notify the owner of the addition to the collection

				if (owner) {
					state.emit(owner, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: slot });
				}

				// notify the observers of the addition to the collection

				if (observers) {
					for (var i = 0, len = observers.length; i < len; i++) {
						state.emit(observers[i].actorId, 'obj.collection.object.add', { objectId: objectId, collectionId: collectionId, slot: slot });
					}
				}

				callback();
			}
		],
		cb);
	});
};


exports.removeObjectFromCollection = function (state, objectId, collectionId, requiredOwner, cb) {
	exports.getCollectionsActors(state, [collectionId], { owners: true, observers: true, mustContainOwnerId: requiredOwner }, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE object = ? AND collection = ?';
		var params = [objectId, collectionId];

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			if (info.affectedRows > 0) {
				state.emitToActors(actorIds, 'obj.collection.object.del', { objectId: objectId, collectionId: collectionId });
			}

			cb();
		});
	});
};


exports.removeObjectFromSlot = function (state, collectionId, slot, requiredOwner, cb) {
	exports.getCollectionsActors(state, [collectionId], { owners: true, observers: true, mustContainOwnerId: requiredOwner }, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		var sql = 'DELETE FROM obj_collection_object WHERE collection = ? AND slot = ?';
		var params = [collectionId, slot];

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			if (info.affectedRows > 0) {
				state.emitToActors(actorIds, 'obj.collection.object.del', { collectionId: collectionId, slot: slot }); // TODO: test!
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


exports.setObjectSlot = function (state, objectId, collectionId, slotNumber, cb) {
	// this function moves an object within a single collection from one slot to another

	exports.getCollectionsActors(state, [collectionId], { owners: true, observers: true }, function (error, actorIds) {
		if (error) {
			return cb(error);
		}

		var sql = 'UPDATE obj_collection_object SET slot = ? WHERE collection = ? AND object = ?';
		var params = [slotNumber, collectionId, objectId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			state.emitToMany(actorIds, 'obj.collection.object.slot.edit', { objectId: objectId, collectionId: collectionId, slot: slotNumber }); // TODO: test!

			cb();
		});
	});
};


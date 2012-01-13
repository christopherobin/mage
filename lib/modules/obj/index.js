var mithril = require('../../mithril'),
	LivePropertyMap = mithril.core.LivePropertyMap,
    objToJson = mithril.core.helpers.objToJson,
    async = require('async');


exports.getManageCommands = function () {
	return ['sync', 'addObjectToPlayer', 'delObject', 'getFullCollectionsByPlayer'];
};


exports.hooks = {
	// chooseObjectCollection returns a collectionId

	chooseObjectCollection: function (state, objClassName, cb) {
		return state.error(null, 'obj.hooks.chooseObjectCollection not defined.', cb);
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

function getClassesSyncData(state, language, cb) {

	var classes = exports.getAllClasses(language, ['none', 'inherit'], true);
	var classIds = [];
	for (var className in classes) {
		var theClass = classes[className];
		classIds.push(theClass.id);
	}
	exports.getClassesActorProperties(state, state.actorId, classIds, { loadAll: true }, function (error, propMaps) {
		if (error) {
			return cb(error);
		}

		var out = [];

		for (var className in classes) {
			var theClass = classes[className];
			var map = propMaps[theClass.id];

			out.push('"' + className + '":' + objToJson(theClass, { actorData: map.stringify(language) }));
		}

		cb(null, '{' + out.join(',') + '}');
	});
}


function getCollectionsSyncData(state, options, cb) {
	// create a select query. columns: collectionId, parentId, type, slotCount, maxWeight, owner

	var collectionIds = [];
	var collections = {};
	var db = state.datasources.db;

	// non-observer part

	var sql = 'SELECT c.id, c.parent AS parentId, c.type, c.slotCount, c.maxWeight, c.owner FROM obj_collection AS c';
	var where = [];
	var params = [];

	if (options.actorId) {
		where.push('c.owner = ?');
		params.push(options.actorId);
	}

	if (options.collectionIds) {
		where.push('c.id IN (' + db.getPlaceHolders(options.collectionIds.length) + ')');
		params = params.concat(options.collectionIds);
	}

	if (where.length === 0) {
		return state.error(null, 'Cannot do an obj_collection sync without any filtering.', cb);
	}

	sql += ' WHERE ' + where.join(' AND ');

	// observer part

	if (options.actorId) {
		sql += ' UNION DISTINCT SELECT c.id, c.parent AS parentId, c.type, c.slotCount, c.maxWeight, c.owner FROM obj_collection_observer AS o JOIN obj_collection AS c ON c.id = o.collectionId WHERE o.actorId = ?';
		params.push(options.actorId);

		if (options.collectionIds) {
			sql += ' AND c.id IN (' + db.getPlaceHolders(options.collectionIds.length) + ')';
			params = params.concat(options.collectionIds);
		}
	}

	db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		if (rows.length === 0) {
			return cb(null, '{}', collectionIds);
		}

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
			collections[coll.id] = coll;
		}

		// load all collection-object links

		var sql = 'SELECT collection, object AS id, slot FROM obj_collection_object WHERE collection IN (' + db.getPlaceHolders(collectionIds.length) + ')';
		var params = [].concat(collectionIds);

		db.getMany(sql, params, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = rows.length; i < len; i++) {
				var member = rows[i];

				if (!member.slot) {
					delete member.slot;
				}

				var collectionId = member.collection;
				delete member.collection;
				collections[collectionId].members.push(member);
			}

			cb(null, JSON.stringify(collections), collectionIds);
		});
	});
}


function getObjectsSyncData(state, options, collectionIds, cb) {
	var sql, params;
	var db = state.datasources.db;

	if (options.objectIds) {
		sql = 'SELECT id, name, weight, appliedToObject, creationTime FROM obj_object WHERE id IN (' + db.getPlaceHolders(options.objectIds.length) + ')';
		params = [].concat(options.objectIds);
	} else {
		sql = 'SELECT o.id, o.name, o.weight, o.appliedToObject, o.creationTime FROM obj_object AS o JOIN obj_collection_object AS co ON o.id = co.object WHERE co.collection IN (' + db.getPlaceHolders(collectionIds.length) + ') GROUP BY o.id';
		params = [].concat(collectionIds);
	}

	db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var selectedObjectIds = [];
		for (var i = 0, len = rows.length; i < len; i++) {
			var o = rows[i];

			// drop unused properties for short transport

			if (!o.appliedToObject) {
				delete o.appliedToObject;
			}

			if (!o.weight) {
				delete o.weight;
			}

			selectedObjectIds.push(o.id);
		}

		exports.getObjectsProperties(state, selectedObjectIds, { loadAll: true }, function (error, maps) { // load all object data
			if (error) {
				return cb(error);
			}

			for (var j = 0, men = rows.length; j < men; j++) {
				var obj = rows[j];
				var map = maps[obj.id];

				if (map) {
					rows[j] = objToJson(obj, { data: map.stringify() });
				} else {
					rows[j] = JSON.stringify(obj);
				}
			}

			cb(null, '[' + rows.join(',') + ']');
		});
	});
}


exports.getSyncData = function (state, options, cb) {
	var out = [];
	var collectionIds = [];
	var language = options.forLanguage || state.language();

	if (options.addCategories) {
		out.push('"categories": ' + JSON.stringify(exports.getAllCategories(language)));
	}

	async.series([
		function (callback) {
			if (!options.addClasses) {
				return callback();
			}

			getClassesSyncData(state, language, function (error, data) {
				if (error) {
					return callback(error);
				}

				out.push('"classes":' + data);
				callback();
			});
		},
		function (callback) {
			// load base collection list

			if (!options.addCollections) {
				return callback();
			}

			getCollectionsSyncData(state, options, function (error, data, colIds) {
				if (error) {
					return callback(error);
				}

				out.push('"collections":' + data);
				collectionIds = colIds;
				callback();
			});
		},
		function (callback) {
			// load all full objects in these collections

			if (!options.addObjects) {
				return callback();
			}

			if ((!options.objectIds || !options.objectIds.length) && (collectionIds.length === 0)) {
				return callback();
			}

			getObjectsSyncData(state, options, collectionIds, function (error, data) {
				if (error) {
					return callback(error);
				}

				out.push('"objects":' + data);
				callback();
			});
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		out = '{' + out.join(',') + '}';
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


exports.getCategory = function (name) {
	return allCategoriesMap[name] || null;
};


exports.getCategoryClasses = function (categoryName) {
	var result = [];

	var classes = allClassesArr;

	for (var i = 0, len = allClassesArr.length; i < len; i++) {
		var objClass = allClassesArr[i];

		for (var j = 0, jlen = objClass.categories.length; j < jlen; j++) {
			if (objClass.categories[j].name.match(categoryName)) {
				result.push(objClass);
				break;
			}
		}
	}

	return result;
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

		outObj.id = objClass.id;

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
	return allClassesMap[className] || null;
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

		return objClass.data.getOne(property, language, tags, fnFilter, fallback);
	}

	return fallback;
};


exports.getClassActorProperties = function (state, classId, actorId, options, cb) {
	var domain = {
		id: classId,
		key: 'obj/class/' + classId + '/actor/' + actorId,
		events: { actorIds: [actorId] }
	};

	LivePropertyMap.create(state, domain, options, cb);
};


exports.getClassesActorProperties = function (state, actorId, classIds, options, cb) {
	var len = classIds.length;
	var domains = new Array(len);

	for (var i = 0; i < len; i++) {
		var classId = classIds[i];

		domains[i] = {
			id: classId,
			key: 'obj/class/' + classId + '/actor/' + actorId,
			events: { actorIds: [actorId] }
		};
	}

	LivePropertyMap.createMany(state, domains, options, cb);
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

			state.emit(actorId, 'obj.collections.sync', data, null, true);

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

exports.getActorObjects = function (state, ownerId, options, cb) {
	options = options || {};

	var db = state.datasources.db;

	var sql = 'SELECT oo.id, oo.name, oo.weight, oo.appliedToObject, oo.creationTime FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id';
	var where = ['oc.owner = ?'];
	var params = [ownerId];

	if (options.classNames) {
		where.push('oo.name IN (' + db.getPlaceHolders(options.classNames.length) + ')');
		params = params.concat(options.classNames);
	}

	sql += ' WHERE ' + where.join(' AND ');
	sql += ' GROUP BY oo.id';

	state.datasources.db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		if (options.groupByClass && options.classNames) {
			var result = {};

			for (var i = 0, len = options.classNames.length; i < len; i++) {
				result[options.classNames[i]] = [];
			}

			for (i = 0, len = rows.length; i < len; i++) {
				var row = rows[i];

				if (row.name in result) {
					result[row.name].push(row);
				}
			}

			return cb(null, result);
		}

		return cb(null, rows);
	});
};


exports.getActorObject = function (state, ownerId, objectId, cb) {
	var query = "SELECT oo.id, oo.name, oo.weight, appliedToObject, creationTime FROM obj_object AS oo JOIN obj_collection_object AS oco ON oo.id = oco.object JOIN obj_collection AS oc ON oco.collection = oc.id WHERE oo.id = ? AND oc.owner = ? GROUP BY oo.id";
	var params = [objectId, ownerId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


// new api:
// exports.addObject = function (state, name, weight, tags, quantity, cb) {};
// creates all the "copy" properties from the class and saves it
// returns the live property maps, so properties may be added: { id: map, id: map }
// if weight is null, the weight will be inherited from the class

// todo: live property map should emit data change events
//       live property map should be reusable
//       we need those damn membase transactions


exports.addObject = function (state, name, weight, tags, quantity, cb) {
	var results = [];
	var creationTime = mithril.core.time;
	quantity = quantity || 1;
	var objClass = allClassesMap[name];

	if (weight === null && objClass && objClass.hasOwnProperty('weight')) {
		weight = objClass.weight;
	}

	async.waterfall([
		function (callback) {
			var sql = 'INSERT INTO obj_object (name, weight, creationTime) VALUES (?, ?, ?)';
			var params = [name, weight, creationTime];
			var count = 0;

			async.whilst(
				function () {
					return count < quantity;
				},
				function (subcallback) {
					count++;
					state.datasources.db.exec(sql, [].concat(params), null, function (error, info) { // create the objects
						if (error) {
							return subcallback(error);
						}
						var objectId = info.insertId >>> 0;
						exports.getObjectProperties(state, objectId, {}, function (error, propMap) {
							if (error) {
								return subcallback(error);
							}
							results.push({ id: objectId, map: propMap });
							subcallback();
						});
					});
				},
				callback
			);
		},
		function (callback) {
			if (objClass) { // store class 'copy' properties
				async.forEachSeries(results, function (obj, objCb) {
					obj.map.importFromStaticPropertyMap(objClass.data, true, tags, function (prop) {
						return prop.meta.behavior === 'copy';
					});
					objCb(); //these get saved with class data, then given back
				}, callback);

			} else {
				callback(); //unsaved empty propmaps get passed along
			}
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, results);
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


exports.getObjectProperties = function (state, objectId, options, cb) {
	var domain = {
		id: objectId,
		key: 'obj/object/' + objectId
	};

	if (options.syncActorIds) {
		domain.events = { actorIds: options.syncActorIds };
	}

	LivePropertyMap.create(state, domain, options, cb);
};


exports.getObjectsProperties = function (state, objectIds, options, cb) {
	var len = objectIds.length;
	var domains = new Array(len);

	for (var i = 0; i < len; i++) {
		var objectId = objectIds[i];

		var domain = {
			id: objectId,
			key: 'obj/object/' + objectId
		};

		if (options.syncActorIds) {
			domain.events = { actorIds: options.syncActorIds };
		}

		domains[i] = domain;
	}

	LivePropertyMap.createMany(state, domains, options, cb);
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
				if (error) {
					return cb(error);
				}
				exports.getObjectProperties(state, objectId, {}, function (error, propMap) {
					if (error) {
						return cb(error);
					}
					propMap.destroy();
					cb();
				});
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

exports.getCollectionIdByType = function (state, type, owner, options, cb) {
	// options: {
	//   optional: false		// set to true to not fail if not found, and return null instead of the ID
	// }

	options = options || {};

	var query = 'SELECT id FROM obj_collection WHERE type = ? AND owner ' + (owner === null ? 'IS' : '=') + ' ? LIMIT 1';
	var params = [type, owner];

	state.datasources.db.getOne(query, params, !options.optional, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		if (row) {
			cb(null, row.id);
		} else {
			cb(null, null);
		}
	});
};


exports.getCollectionById = function (state, collectionId, cb) {
	var query = 'SELECT id, parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.countCollectionObjectsById = function (state, collectionId, cb) {
	var query = 'SELECT COUNT(*) AS count FROM obj_collection_object WHERE collection = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function (error, data) {
		if (error) {
			return cb(error);
		}

		cb(null, data.count);
	});
};


exports.countCollectionObjectsByType = function (state, type, owner, cb) {
	exports.getCollectionIdByType(state, type, owner, null, function (error, collectionId) {
		if (error) {
			return cb(error);
		}

		exports.countCollectionObjectsById(state, collectionId, function (error, count) {
			if (error) {
				return cb(error);
			}

			cb(null, count);
		});
	});
};


exports.getFullCollectionByType = function (state, type, owner, options, cb) {
	// does a getFullCollection by type, instead of ID

	exports.getCollectionIdByType(state, type, owner, null, function (error, id) {
		if (error) {
			return cb(error);
		}

		exports.getFullCollection(state, id, options, cb);
	});
};


exports.getFullCollection = function (state, collectionId, options, cb) {
	var collection = null;
	options = options || {};

	async.waterfall([
		function (callback) {
			var query = 'SELECT parent, type, slotCount, maxWeight, owner FROM obj_collection WHERE id = ?';
			var params = [collectionId];

			state.datasources.db.getOne(query, params, true, null, callback);
		},
		function (row, callback) {
			collection = row;
			collection.id = collectionId;

			var query = 'SELECT o.id, co.slot, o.appliedToObject, o.weight, o.name, o.creationTime FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? ORDER BY co.slot ASC';
			var params = [collectionId];

			state.datasources.db.getMany(query, params, null, callback);
		},
		function (rows, callback) {
			collection.objects = rows;

			var objectIds = [];

			for (var i = 0, len = rows.length; i < len; i++) {
				objectIds.push(rows[i].id);
			}

			exports.getObjectsProperties(state, objectIds, options.properties || {}, callback);
		},
		function (maps, callback) {
			for (var i = 0, len = collection.objects.length; i < len; i++) {
				var o = collection.objects[i];

				o.data = maps[o.id] || null;	// the null should really never happen
			}

			callback();
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, collection);
	});
};


exports.addCollection = function (state, type, slotCount, maxWeight, parentCollection, owner, cb) {
	var sql = 'INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES (?, ?, ?, ?, ?)';
	var params = [type, slotCount, maxWeight, parentCollection, owner];

	state.datasources.db.exec(sql, params, null, function (err, info) {
		if (err) {
			return cb(err);
		}

		if (owner) {
			state.emit(owner, 'obj.collection.add', { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentId: parentCollection, owner: owner });
		}

		cb(null, { id: info.insertId, type: type, slotCount: slotCount, maxWeight: maxWeight, parentCollection: parentCollection, owner: owner });
	});
};


exports.addCollections = function (state, data, cb) { //WARNING does not emit.  only useful when user is not logged in.
	// data [{ type:'', slotCount: #, maxWeight: #, parentCollection: #, owner: # }]

	var sql = 'INSERT INTO obj_collection (type, slotCount, maxWeight, parent, owner) VALUES';
	var sqlValues = [];
	var params = [];

	for (var i = 0, len = data.length; i < len; i++) {
		var item = data[i];
		sqlValues.push(' (?, ?, ?, ?, ?)');
		params = params.concat([item.type, item.slotCount, item.maxWeight, item.parent, item.owner]);
	}

	sql += sqlValues.join(',');

	state.datasources.db.exec(sql, params, null, function (err, info) {
		if (err) {
			return cb(err);
		}

		cb();
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

		var sql = 'SELECT type, slotCount, maxWeight, parent FROM obj_collection WHERE id = ?';
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

		var allowedFields = ['type', 'slotCount', 'maxWeight', 'parent'];

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


exports.delCollection = function (state, collectionId, options, cb) {
	collectionId = collectionId >>> 0;

	options = options || {};

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

		// for each object in this collection, check the total amount of collections it is in.
		// in every case, this should at least be 2, otherwise we would be creating orphaned objects, which is not allowed.

		var sql = 'SELECT COUNT(*) AS parents FROM obj_collection_object AS o JOIN obj_collection_object AS co ON co.object = o.object WHERE o.collection = ? GROUP BY o.object';
		var params = [collectionId];

		state.datasources.db.getMany(sql, params, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = rows.length; i < len; i++) {
				var row = rows[i];

				if (~~row.parents < 2) {
					return state.error(null, 'Trying to orphan an object in collection ' + collectionId, cb);
				}
			}

			var sql = 'DELETE FROM obj_collection WHERE id = ?';
			var params = [collectionId];

			state.datasources.db.exec(sql, params, null, function (error) {
				if (error) {
					return cb(error);
				}

				state.emitToActors(actorIds, 'obj.collection.del', { id: collectionId });

				cb();
			});
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


exports.getObjectIdsByNameFromCollection = function (state, collectionId, objectName, options, cb) {
/* Supported options:
 *   maxResults: integer that limits the result to N ids
 *   required: {
 *     amount: integer that describes the minimum required IDs
 *     error:  optional error code that is thrown if amount is not met
 *   }
 */

	options = options || {};

	var sql = 'SELECT o.id FROM obj_object AS o JOIN obj_collection_object AS co ON co.object = o.id WHERE co.collection = ? AND o.name = ?';
	var params = [collectionId, objectName];

	if (options.maxResults) {
		var limit = ~~options.maxResults;

		if (limit > 0) {
			sql += 'LIMIT ' + limit;
		}
	}

	state.datasources.db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var len = rows.length;

		if (options.required && ('amount' in options.required)) {
			var required = ~~options.required.amount;

			if (len < required) {
				return state.userError(options.required.error || null, cb);
			}
		}

		var ids = [];

		for (var i = 0; i < len; i++) {
			ids.push(rows[i].id);
		}

		cb(null, ids);
	});
};


exports.doObjectsFitInCollection = function (state, collectionId, objects, options, cb) {
	// options:
	// - replaceExistingObjectInSlot: Boolean (optional). If true, will replace any currently existing object in the given slot. If false, will fail if the slot is occupied.
	// - weightProvided: Boolean (optional). If true, weights (if any) will be set on the objects. Else, the weights will be loaded from DB.
	// - addedWeight: Integer (optional). The total amount of added weight by these objects. Ignored if weightProvided is false.

	// objects: [{
	//   id: int		// required if weightsProvided is false
	//   slot: int		// optional, and if there is a slot assigned to this object, it will be set here
	//   weight: int	// optional, ignored if weightsProvided is false or options.addedWeight is set.
	// }, ...]

	options = options || {};
	collectionId = collectionId >>> 0;

	// check for valid collectionId

	if (!collectionId) {
		return state.error(null, collectionId + ' is not a valid collectionId in obj.doObjectsFitInCollection.', cb);
	}

	// prepare a response

	var response = {
		fits: true,
		reason: null,
		removedObjects: [],
		removedWeight: 0,
		objects: objects		// same object as the input, and now they have all their slots is set (if needed)
	};

	// load collection capacity info

	var query = 'SELECT slotCount, maxWeight FROM obj_collection WHERE id = ?';
	var params = [collectionId];

	state.datasources.db.getOne(query, params, true, null, function (err, data) {
		if (err) {
			return cb(err);
		}

		var maxWeight = data.maxWeight;
		var slotCount = data.slotCount;

		// If there is a slotCount, or maxWeight, we have to load the current collection's slot occupation and total weight info.
		// This way we can see if an existing object at the slot has to be replaced, and if the new object will fit.

		if (!slotCount && !maxWeight) {
			return cb(null, response);
		}

		var query = 'SELECT co.slot, o.id, o.weight FROM obj_collection_object AS co JOIN obj_object AS o ON o.id = co.object WHERE co.collection = ?';
		var params = [collectionId];

		state.datasources.db.getMany(query, params, null, function (error, currentCollection) {
			if (error) {
				return cb(error);
			}

			// analyze slots

			var j, jlen, i, len, obj, o;

			if (slotCount) {
				// There is a slotcount, so therefore the object to be added needs to get a slot.
				// If no slot has been specified, the first available slot should be used.
				// If a slot has been specified, any existing object must be removed from that slot. NOTE: this is dangerous, because it may become orphaned!
				// If no slot is available, throw an error

				// first we make a list of occupied slot numbers (this list will grow as we assign slots)

				var occupiedSlots = {};

				for (i = 0, len = currentCollection.length; i < len; i++) {
					obj = currentCollection[i];
					if (obj.slot) {
						occupiedSlots[obj.slot] = obj;
					}
				}

				// for each object that has a predetermined slot number, ensure correctness, or drop previous object in that slot

				for (i = 0, len = objects.length; i < len; i++) {
					o = objects[i];

					if (o.slot >>> 0) {
						o.slot = (o.slot >>> 0);
					}

					if (!o.slot) {
						continue;
					}

					// a slot has been provided

					// check if given slot are within bounds of collection's slotCount

					if (o.slot < 1) {
						return state.error(null, 'Invalid slot: ' + o.slot, cb);
					}

					if (o.slot > slotCount) {
						return state.error(null, 'Invalid slot: ' + o.slot + ', this collection has capacity: ' + slotCount, cb);
					}

					// we must check if an object needs to be replaced

					obj = occupiedSlots[o.slot];
					if (obj) {
						// the picked slot has already been taken

						// if taken by one of our new objects, this is invalid

						if (obj === true) {
							return state.error(null, 'Cannot assign 2 objects to the same slot.', cb);
						}

						// if we are not allowed to replace, return an error

						if (!options.replaceExistingObjectInSlot) {
							response.fits = false;
							response.reason = 'noFreeSlot';

							return cb(null, response);
						}

						response.removedWeight += (obj.weight >>> 0);
						response.removedObjects.push(obj.id);

						occupiedSlots[o.slot] = true;
					}
				}

				// for each object that needs to be added to the collection, but which has no assigned slot, assign a free slot now

				for (i = 0, len = objects.length; i < len; i++) {
					o = objects[i];

					if (o.slot) {
						continue;
					}

					// no slot number has been provided, detect first available slot

					for (var slotIndex = 1;  slotIndex <= slotCount; slotIndex++) {
						obj = occupiedSlots[slotIndex];

						if (!obj) {
							o.slot = slotIndex;
							occupiedSlots[slotIndex] = true;	// true means: now occupied by a new object! cannot be overwritten within this loop
							break;
						}
					}

					if (!o.slot) {
						response.fits = false;
						response.reason = 'noFreeSlot';

						return cb(null, response);
					}
				}
			}

			// analyze weight

			if (maxWeight) {
				// calculate the current total weight of the collection

				var currentTotalWeight = 0;

				for (i = 0, len = currentCollection.length; i < len; i++) {
					currentTotalWeight += (currentCollection[i].weight >>> 0);
				}

				// read the weight of the objects we're trying to insert into the collection

				var addedWeight = 0;

				if (options.weightProvided) {
					if (options.hasOwnProperty('addedWeight')) {
						addedWeight = options.addedWeight >>> 0;
					} else {
						for (i = 0, len = objects.length; i < len; i++) {
							addedWeight += (objects[i].weight >>> 0);
						}
					}

					if (currentTotalWeight + addedWeight - response.removedWeight > maxWeight) {
						// collection is full

						response.fits = false;
						response.reason = 'maxWeightExceeded';
					}

					cb(null, response);
				} else {
					var params = [];

					for (i = 0, len = objects.length; i < len; i++) {
						obj = objects[i];

						if (!obj.id) {
							return state.error(null, 'Trying to detect weight from object, but no ID provided.', cb);
						}

						params.push(obj.id);
					}

					var sql = 'SELECT SUM(weight) AS weight FROM obj_object WHERE id IN (' + state.datasources.db.getPlaceHolders(params.length) + ')';

					state.datasources.db.getOne(sql, params, true, null, function (error, row) {
						if (error) {
							return cb(error);
						}

						var addedWeight = (row.weight >>> 0);

						if (currentTotalWeight + addedWeight - response.removedWeight > maxWeight) {
							// collection is full

							response.fits = false;
							response.reason = 'maxWeightExceeded';
						}

						cb(null, response);
					});

					return;
				}
			} else {
				// no max weight enforcement

				cb(null, response);
			}
		});
	});
};


exports.addObjectsToCollection = function (state, objects, collectionId, options, cb) {
	// options:
	// - requiredOwner: Number (optional).
	// - noErrorOnFullCollection: Boolean (optional). If the object could not be inserted because of no slot being available, or maxWeight being exceeded, no fatal error is thrown and execution continues.
	// - replaceExistingObjectInSlot: Boolean (optional). If true, will replace any currently existing object in the given slot. If false, will fail if the slot is occupied.

	// objects: [{
	//   id: int,		// required
	//   slot: int		// optional, but will be set externally if required
	// }]


	options = options || {};
	collectionId = collectionId >>> 0;

	// check for valid collectionId

	if (!collectionId) {
		return state.error(null, collectionId + ' is not a valid collectionId in obj.addObjectToCollection.', cb);
	}

	// check if the object would fit in the collection

	var fitCheckOptions = {
		replaceExistingObjectInSlot: options.replaceExistingObjectInSlot
	};

	exports.doObjectsFitInCollection(state, collectionId, objects, fitCheckOptions, function (error, fitResponse) {
		if (error) {
			return cb(error);
		}

		if (!fitResponse.fits) {
			if (options.noErrorOnFullCollection) {
				cb(null, { inserted: false, reason: fitResponse.reason });
			} else {
				state.userError(fitResponse.reason, cb);
			}
			return;
		}

		// the object fits!

		var removedObjects = fitResponse.removedObjects;
		var actors;
		var actorIds = [];


		async.series([
			function (callback) {
				// load all observers and the new owner, because we need to notify them all

				var caOptions = {
					owners: true,
					observers: true,
					includeLanguage: true
				};

				if (options.requiredOwner) {
					caOptions.mustContainOwnerId = options.requiredOwner;
				}

				exports.getCollectionsActors(state, [collectionId], caOptions, function (error, results) {
					if (error) {
						return callback(error);
					}

					actors = results;

					for (var i = 0, len = actors.length; i < len; i++) {
						actorIds.push(actors[i].actorId);
					}

					callback();
				});
			},
			function (callback) {
				// remove any objects from the collection that need removing

				if (removedObjects.length === 0) {
					return callback();
				}

				var sql = 'DELETE FROM obj_collection_object WHERE collection = ? AND object IN (' + state.datasources.db.getPlaceHolders(removedObjects.length) + ')';
				var params = [collectionId].concat(removedObjects);

				state.datasources.db.exec(sql, params, null, function (error) {
					if (error) {
						return callback(error);
					}

					// emit events

					if (actors) {
						for (var i = 0, len = removedObjects.length; i < len; i++) {
							state.emitToActors(actorIds, 'obj.collection.object.del', { objectId: removedObjects[i], collectionId: collectionId });
						}
					}

					callback();
				});
			},
			function (callback) {
				// observers and (new) owner need to sync the object, since it may not have been known

				if (!actors) {
					return callback();
				}

				var langMap = {};
				var languages = [];

				for (var i = 0, len = actors.length; i < len; i++) {
					var actor = actors[i];
					var language = actor.language;

					var langActors = langMap[language];
					if (langActors) {
						langActors.push(actor.actorId);
					} else {
						langActors = langMap[language] = [actor.actorId];
						languages.push({ language: language, actorIds: langActors });
					}
				}

				var objectIds = fitResponse.objects.map(function (o) {
					return o.id;
				});

				async.forEachSeries(
					languages,
					function (language, callback2) {
						exports.getSyncData(state, { addObjects: true, objectIds: objectIds, forLanguage: language }, function (error, data) {
							if (error) {
								return callback2(error);
							}

							// we are language aware in which actors we emit to, so state.emitToActors doesn't have to be

							state.emitToActors(language.actorIds, 'obj.collections.sync', data, null, true);

							callback2();
						});
					},
					callback
				);
			},
			function (callback) {
				// register the objects to this collection
				// notify the owner and observers of the additions to the collection

				var sql = 'INSERT INTO obj_collection_object (collection, object, slot) VALUES ';
				var records = [];
				var params = [];

				for (var i = 0, len = fitResponse.objects.length; i < len; i++) {
					var o = fitResponse.objects[i];

					records.push('(?, ?, ?)');
					params.push(collectionId, o.id, o.slot || null);

					if (actors) {
						state.emitToActors(actorIds, 'obj.collection.object.add', { objectId: o.id, collectionId: collectionId, slot: o.slot || null });
					}
				}

				sql += records.join(', ');

				state.datasources.db.exec(sql, params, null, callback);
			}
		],
		function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, { inserted: true });
			}
		});
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


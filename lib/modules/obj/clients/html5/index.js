(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.obj.construct'));


	var cache = {};


	function resetData() {
		cache.categoriesIdMap = {};
		cache.categoriesMap = {};
		cache.categoriesArr = [];
		cache.classesMap = {};
		cache.classesArr = [];
		cache.collectionsArr = [];
		cache.objectsArr = [];
		cache.objectsMap = {};
	}

	resetData();


	// class definitions
	// -----------------

	// Categories

	function ObjCategory(category) {
		this.id = category.id;
		this.name = category.name;

		this.initPropertyMap('obj/category/' + this.id, category.data);
	}

	ObjCategory.prototype = new mithril.data.PropertyMap();

	mod.ObjCategory = ObjCategory;


	ObjCategory.prototype.getClasses = function () {
		var result = [];

		for (var i = 0, len = cache.classesArr.length; i < len; i++) {
			var objClass = cache.classesArr[i];

			if (objClass && objClass.inCategory(this.name)) {
				result.push(objClass);
			}
		}

		return result;
	};


	ObjCategory.prototype.getObjects = function (options) {
		options = options || {};

		var result = [], o;

		for (var i = 0, len = cache.objectsArr.length; i < len; i++) {
			o = cache.objectsArr[i];

			if (o && o.inCategory(this.name)) {
				result.push(o);
			}
		}

		// for category X, give me all objects per class

		if (options.groupByClass) {
			var byClass = {};

			var classes = this.getClasses();

			for (i = 0, len = classes.length; i < len; i++) {
				byClass[classes[i].name] = [];
			}

			for (i = 0, len = result.length; i < len; i++) {
				o = result[i];

				if (o.name in byClass) {
					byClass[o.name].push(o);
				} else {
					byClass[o.name] = [o];
				}
			}

			return byClass;
		}

		return result;
	};


	// Class logic

	function ObjClassActorData(classId, actorId, data) {
		this.initPropertyMap('obj/class/' + classId + '/actor/' + actorId, data);
	}

	ObjClassActorData.prototype = new mithril.data.PropertyMap();

	mod.ObjClassActorData = ObjClassActorData;


	function ObjClass(cl, name) {
		this.id = cl.id;
		this.name = name;
		this.categories = [];

		this.initPropertyMap('obj/class/' + this.id, cl.data);

		var actorId = mithril.actor.me.id;

		this.actorData = new ObjClassActorData(this.id, actorId, null);	// TODO: add the sync data

		if (cl.categories) {
			for (var i = 0, len = cl.categories.length; i < len; i++) {
				var category = cache.categoriesIdMap[cl.categories[i]];

				if (category) {
					this.categories.push(category);
				}
			}
		}
	}

	ObjClass.prototype = new mithril.data.PropertyMap();

	mod.ObjClass = ObjClass;


	ObjClass.prototype.inCategory = function (name) {
		for (var i = 0, len = this.categories.length; i < len; i++) {
			if (this.categories[i].name === name) {
				return true;
			}
		}

		return false;
	};


	// Object logic

	function ObjObject(o) {
		this.sync(o);
	}

	ObjObject.prototype = new mithril.data.PropertyMap();

	ObjObject.prototype.sync = function (o) {
		var parentClass = cache.classesMap[o.name] || null;

		this.id = o.id;
		this.name = parentClass ? parentClass.name : o.name;
		this.parentClass = parentClass;
		this.weight = o.weight || null;
		this.appliedToObjectId = o.appliedToObject || null;
		this.creationTime = o.creationTime;
		this.initPropertyMap('obj/object/' + o.id, o.data);
	};


	mod.ObjObject = ObjObject;


	ObjObject.prototype.inCategory = function (name) {
		if (!this.parentClass) {
			return false;
		}

		var categories = this.parentClass.categories;

		for (var i = 0, len = categories.length; i < len; i++) {
			if (categories[i].name === name) {
				return true;
			}
		}

		return false;
	};


	ObjObject.prototype.get = function (property) {
		// overrides the prototype's get function

		if (property in this.data) {
			return this.data[property];
		}

		if (this.parentClass && property in this.parentClass.data) {
			return this.parentClass.get(property);
		}

		return null;
	};


	// Collection logic

	function ObjCollection(collection) {
		this.sync(collection);
	}

	ObjCollection.prototype = new mithril.data.PropertyMap();

	ObjCollection.prototype.sync = function (c) {
		this.id = c.id;
		this.parentId = c.parentId || null;
		this.type = c.type;
		this.slotCount = c.slotCount || null;
		this.maxWeight = c.maxWeight || null;
		this.owner = c.owner || null;
		this.objects = [];

		if (c.members) {
			for (var i = 0, len = c.members.length; i < len; i++) {
				var member = c.members[i];

				var o = mod.getObject(member.id);

				if (o && !this.contains(o.id)) {
					this.replaceObject(o, member.slot);
				}
			}
		}

		this.initPropertyMap('obj/collection/' + this.id, c.data);
	};

	mod.ObjCollection = ObjCollection;


	ObjCollection.prototype.getChildren = function (type) {
		var result = [];

		for (var i = 0, len = cache.collectionsArr.length; i < len; i++) {
			var collection = cache.collectionsArr[i];

			if (collection.parentId === this.id && (!type || collection.type.match(type))) {
				result.push(collection);
			}
		}

		return result;
	};


	ObjCollection.prototype.addObject = function (object, slot) {
		var info = { object: object };

		if (slot !== undefined && slot !== null) {
			info.slot = ~~slot;
		}

		this.objects.push(info);
	};


	ObjCollection.prototype.replaceObject = function (object, slot) {
		// adds the object, but removes the old one by that ID if it exists

		var info = { object: object };

		if (slot !== undefined && slot !== null) {
			info.slot = (slot >>> 0);
		}

		var objectId = object.id;

		for (var i = 0, len = this.objects.length; i < len; i++) {
			var entry = this.objects[i];

			if (entry.object.id === objectId) {
				// replace

				this.objects[i] = info;
				return;
			}
		}

		// not replaced

		this.objects.push(info);
	};


	ObjCollection.prototype.delObject = function (objectId) {
		var newlist = [];
		var deleted = false;

		for (var i = 0, len = this.objects.length; i < len; i++) {
			var entry = this.objects[i];

			if (entry.object.id !== objectId) {
				newlist.push(entry);
			} else {
				deleted = true;
			}
		}

		this.objects = newlist;

		return deleted;
	};


	ObjCollection.prototype.getObject = function (objectId) {
		var n = this.objects.length;
		while (n--) {
			if (this.objects[n].object.id === objectId) {
				return this.objects[n];
			}
		}
		return null;
	};


	ObjCollection.prototype.contains = function (objectId) {
		objectId = ~~objectId;

		for (var i = 0, len = this.objects.length; i < len; i++) {
			if (this.objects[i].object.id === objectId) {
				return true;
			}
		}

		return false;
	};


	ObjCollection.prototype.containsName = function (objectName) {
		for (var i = 0, len = this.objects.length; i < len; i++) {
			if (this.objects[i].object.name.match(objectName)) {
				return true;
			}
		}

		return false;
	};


	ObjCollection.prototype.getObjectsByName = function (objectName) {
		var result = [];

		for (var i = 0, len = this.objects.length; i < len; i++) {
			var entry = this.objects[i];

			if (entry.object.name.match(objectName)) {
				result.push(entry);
			}
		}

		return result;
	};


	ObjCollection.prototype.getObjectBySlotNumber = function (slot) {
		slot = ~~slot;

		var n = this.objects.length;
		while (n--) {
			if (this.objects[n].slot === slot) {
				return this.objects[n];
			}
		}

		return null;
	};


	ObjCollection.prototype.getWeight = function () {
		var weight = 0;

		var n = this.objects.length;
		while (n--) {
			weight += this.objects[n].object.weight || 0;
		}

		return weight;
	};


	ObjCollection.prototype.uniqueNames = function () {
		var names = [];

		for (var i = 0, len = this.objects.length; i < len; i++) {
			var name = this.objects[i].object.name;

			if (names.indexOf(name) === -1) {
				names.push(name);
			}
		}

		return names;
	};


	// module api
	// ---------------

	mod.getCategory = function (name) {
		return cache.categoriesMap[name] || null;
	};


	mod.getCategories = function () {
		return cache.categoriesArr;
	};


	mod.getCategoriesByName = function (name) {
		var result = [];

		for (var i = 0, len = cache.categoriesArr.length; i < len; i++) {
			var category = cache.categoriesArr[i];

			if (category.name.match(name)) {
				result.push(category);
			}
		}

		return result;
	};


	mod.getClassesByName = function (name) {
		var result = [];

		for (var i = 0, len = cache.classesArr.length; i < len; i++) {
			var objClass = cache.classesArr[i];

			if (objClass.name.match(name)) {
				result.push(objClass);
			}
		}

		return result;
	};


	mod.getClass = function (name) {
		return cache.classesMap[name] || null;
	};


	mod.getObject = function (objectId) {
		return cache.objectsMap[objectId] || null;
	};


	mod.getCollectionById = function (id) {
		var result = [];

		for (var i = 0, len = cache.collectionsArr.length; i < len; i++) {
			if (cache.collectionsArr[i].id === id) {
				return cache.collectionsArr[i];
			}
		}

		return null;
	};


	mod.getCollections = function (type, ownerId) {
		ownerId = ownerId ? ~~ownerId : null;

		var result = [];

		for (var i = 0, len = cache.collectionsArr.length; i < len; i++) {
			var collection = cache.collectionsArr[i];

			if (ownerId && collection.owner !== ownerId) {
				continue;
			}

			if (type && !collection.type.match(type)) {
				continue;
			}

			result.push(collection);
		}

		return result;
	};


	function getMyId() {
		if (mithril.actor && mithril.actor.me) {
			return mithril.actor.me.id;
		}

		return null;
	}


	mod.getMyCollections = function (type) {
		return mod.getCollections(type, getMyId());
	};


	mod.getObservedCollections = function (type) {
		var myId = getMyId();

		var result = [];

		for (var i = 0, len = cache.collectionsArr.length; i < len; i++) {
			var collection = cache.collectionsArr[i];

			if (type && collection.type !== type) {
				continue;
			}

			if (collection.owner !== myId) {
				result.push(collection);
			}
		}

		return result;
	};


	// setup
	// ---------------

	function mergeSyncData(sync) {
		var i, len, info;

		// categories

		if (sync.categories) {
			len = sync.categories.length;

			for (i = 0; i < len; i++) {
				info = sync.categories[i];

				var category = cache.categoriesIdMap[info.id];

				if (category) {
					category.sync(info);
				} else {
					category = new ObjCategory(sync.categories[i]);

					cache.categoriesIdMap[category.id] = category;
					cache.categoriesMap[category.name] = category;
					cache.categoriesArr.push(category);
				}
			}
		}

		// class data

		if (sync.classes) {
			for (var key in sync.classes) {
				info = sync.classes[i];

				var objClass = cache.classesMap[key];

				if (objClass) {
					objClass.sync(info);
				} else {
					objClass = new ObjClass(info, key);

					cache.classesArr.push(objClass);
					cache.classesMap[key] = objClass;
				}
			}
		}

		// object and collection data

		if (sync.objects) {
			len = sync.objects.length;

			for (i = 0; i < len; i++) {
				info = sync.objects[i];

				var o = mod.getObject(info.id);
				if (o) {
					o.sync(info);
				} else {
					o = new ObjObject(info);

					cache.objectsArr.push(o);
					cache.objectsMap[o.id] = o;
				}
			}
		}

		if (sync.collections) {
			for (var collectionId in sync.collections) {
				info = sync.collections[collectionId];

				var collection = mod.getCollectionById(collectionId);

				if (collection) {
					collection.sync(info);

				} else {
					collection = new ObjCollection(info);

					cache.collectionsArr.push(collection);
				}
			}
		}
	}


	mod.dropSyncData = function (desync) {
		var collectionIds = desync.collectionIds;

		var collection, objectIds = [];

		// make a list of all objects in the given collections

		var getId = function (o) {
			return o.object.id;
		};

		for (var i = 0, len = collectionIds.length; i < len; i++) {
			collection = mod.getCollectionById(collectionIds[i]);

			if (collection) {
				objectIds = objectIds.concat(collection.objects.map(getId));
			}
		}

		// drop collections that need to be desynced

		cache.collectionsArr = cache.collectionsArr.filter(function (collection) {
			var keep = collectionIds.indexOf(collection.id) === -1;

			if (!keep) {
				collection.destroy();
			}

			return keep;
		});

		// cleanup all orphan objects

		var objectId, orphans = [];

		for (i = 0, len = objectIds.length; i < len; i++) {
			var orphaned = true;
			objectId = objectIds[i];

			for (var j = 0, jlen = cache.collectionsArr.length; j < jlen; j++) {
				collection = cache.collectionsArr[j];

				if (collection.contains(objectId)) {
					orphaned = false;
					break;
				}
			}

			if (orphaned) {
				orphans.push(objectId);
			}
		}

		for (i = 0, len = orphans.length; i < len; i++) {
			objectId = orphans[i];

			var o = cache.objectsMap[objectId];
			if (o) {
				o.destroy();
				delete cache.objectsMap[objectId];
			}
		}

		cache.objectsArr = cache.objectsArr.filter(function (obj) {
			return orphans.indexOf(obj.id) === -1;
		});
	};


	mod.setup = function (cb) {
		var io = mithril.io;

		// setup event listeners

		io.on('obj.collection.add', function (path, params) {
			var collection = new ObjCollection(params);
			cache.collectionsArr.push(collection);
		}, true);


		io.on('obj.collection.edit', function (path, params) {
			var collection = mod.getCollectionById(params.id);

			delete params.id;

			for (var key in params) {
				collection[key] = params[key];
			}
		}, true);


		io.on('obj.collection.del', function (path, params) {
			cache.collectionsArr = cache.collectionsArr.filter(function (collection) {
				return collection.id !== params.id;
			});
		}, true);


		io.on('obj.collection.object.add', function (path, params) {
			var collection = mod.getCollectionById(params.collectionId);
			if (!collection) {
				return false;
			}

			if (params.slot !== undefined && params.slot !== null) {
				// make sure that there is nothing in this slot

				if (collection.getObjectBySlotNumber(params.slot) !== null) {
					return false;
				}
			}

			// make sure this object is not already a member

			if (collection.contains(params.objectId)) {
				return false;
			}

			var obj = mod.getObject(params.objectId);
			if (!obj) {
				return false;
			}

			collection.addObject(obj, params.slot);
		}, true);


		io.on('obj.collection.object.del', function (path, params) {
			var collection = mod.getCollectionById(params.collectionId);
			if (!collection) {
				return false;
			}

			var obj = null;

			if (params.objectId) {
				obj = collection.getObject(params.objectId);
			} else if ('slot' in params) {
				obj = collection.getObjectBySlotNumber(params.slot);
			}

			if (!obj) {
				return false;
			}

			params.slot = obj.slot;

			if (!collection.delObject(obj.object.id)) {
				return false;
			}
		}, true);


/*
 * currently unused
	io.on('obj.collection.edit', function (path, params) {
		for (var i=0, len = cache.collectionsArr.length; i < len; i++) {
			var col = cache.collectionsArr[i];

			if (params.collectionId === col.id) {
				if ('collectionType' in params) {
					col.type = params.collectionType;
				}

				if ('parent' in params) {
					col.parent = params.parent;
				}

				if ('slotCount' in params) {
					col.slotCount = params.slotCount;
				}

				if ('maxWeight' in params) {
					col.maxWeight = params.maxWeight;
				}

				break;
			}
		}
	}, true);
*/

		io.on('obj.collection.object.slot.edit', function (path, params) { //this is quite brutal and is untested
			var collection = mod.getCollectionById(params.collectionId);
			if (collection) {
				var len = collection.objects.length;

				for (var i = 0; i < len; i++) {
					if (collection.objects[i].slot === params.slot) {
						collection.objects[i].object = cache.objectsMap[params.objectId];
					}
				}
			}
		}, true);


		io.on('obj.object.add', function (path, params) {
			var o = new ObjObject(params);

			cache.objectsArr.push(o);
			cache.objectsMap[o.id] = o;
		}, true);


		io.on('obj.object.weight.edit', function (path, params) {	// untested
			var obj = mod.getObject(params.id);
			if (!obj) {
				return false;
			}

			obj.weight = params.to;
		}, true);


		io.on('obj.object.appliedToObjectId.edit', function (path, params) {  // untested
			var obj = mod.getObject(params.id);
			if (!obj) {
				return false;
			}

			obj.appliedToObjectId = params.to;
		}, true);


		io.on('obj.object.del', function (path, params) {
			for (var i = 0, len = cache.collectionsArr.length; i < len; i++) {
				// trigger events that the object has been removed from the collection (if it was in there)

				var collection = cache.collectionsArr[i];

				if (collection.contains(params.objectId)) {
					io.emit('obj.collection.object.del', { objectId: params.objectId, collectionId: collection.id });
				}
			}

			delete cache.objectsMap[params.objectId];

			cache.objectsArr = cache.objectsArr.filter(function (obj) {
				return obj.id !== params.objectId;
			});
		}, true);


		io.on('obj.collections.sync', function (path, params) {
			// full data reset on a collection

			mergeSyncData(params);
		});


		io.on('obj.collections.desync', function (path, params) {
			// full data removal on a collection
			// remove it, and all its objects (if they're not part of another known collection)

			mod.dropSyncData(params);
		});


		// retrieve all object classes and the full actor's collections

		mod.sync(function (errors, response) {
			if (errors) {
				return cb(errors);
			}

			resetData();
			mergeSyncData(response);

			cb();
		});
	};

}());

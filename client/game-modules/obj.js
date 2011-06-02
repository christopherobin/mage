function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}


MithrilGameModObj.prototype.setup = function(cb)
{
	var _this = this;

	// setup event listeners

	this.mithril.io.on('obj.collection.object.add', function(path, params)
	{
		var collection = _this.getMyCollectionById(params.collectionId);
		if (!collection) return false;

		if (params.slot !== undefined && params.slot !== null)
		{
			// make sure that there is nothing in this slot

			if (collection.getObjectBySlotNumber(params.slot) !== null) return false;
		}

		// make sure this object is not already a member

		if (collection.contains(params.objectId))
		{
			return false;
		}

		var obj = _this.getObject(params.objectId);
		if (!obj)
		{
			return false;
		}

		collection.addObject(obj, params.slot);
	}, true);


	this.mithril.io.on('obj.collection.object.del', function(path, params)
	{
		var collection = _this.getMyCollectionById(params.collectionId)
		var obj = null;

		if (params.objectId)
		{
			obj = collection.getObject(params.objectId);
		}
		else if ('slot' in params)
		{
			obj = collection.getObjectBySlotNumber(params.slot);
		}

		if (!obj) return false;

		params.slot = obj.slot;

		if (!collection.delObject(obj.object.id)) return false;
	}, true);


	this.mithril.io.on('obj.collection.add', function(path, params)
	{
		var collection = new MithrilGameModObj_Collection(params);
		_this.playerCache.collections.push(collection);
	}, true);


	this.mithril.io.on('obj.collection.del', function(path, params)
	{
		_this.playerCache.collections = _this.playerCache.collections.filter(function(collection) { return (collection.id != params.collectionId); });
	}, true);


	this.mithril.io.on("obj.collection.edit", function(path, params){
		for (var i=0; i < _this.playerCache.collections.length; i++) //untested
		{
			if (params.collectionId == _this.playerCache.collections[i].id)
			{
				if ('collectionType' in params) { _this.playerCache.collections[i].type = params.collectionType; }
				if ('parent' in params) { _this.playerCache.collections[i].parent = params.parent; }
				if ('slotCount' in params) { _this.playerCache.collections[i].slotCount = params.slotCount; }
				if ('maxWeight' in params) { _this.playerCache.collections[i].maxWeight = params.maxWeight; }
			}
		}
	}, true);


	this.mithril.io.on("obj.collection.object.setObjectSlot", function(path, params){ //this is quite brutal and is untested
		var slot;
		var collection = null;
		var len = _this.playerCache.collections.length;
		for(var i=0;i<len;i++)
		{
			if (_this.playerCache.collections[i].id == params.collectiondId) { collection = _this.playerCache.collections[i]; break; }
		}
		if (collection)
		{
			var men = collection.objects.length;
			for(var j=0;j<men;j++)
			{
				if (collection.objects[j].slot == params.slot)
				{
					collection.objects[j].object = _this.playerCache.objectIds[params.objectId];
				}
			}
		}
	}, true);


	this.mithril.io.on('obj.object.add', function(path, params)
	{
		_this.playerCache.objectIds[params.id] = params;
		_this.playerCache.objects.push(params);
	}, true);


	this.mithril.io.on("obj.object.edit", function(path, params){ //untested
		for(var key in params)
		{	//name,weight,id
			_this.playerCache.objectIds[params.id][key] = params[key];
		}
	}, true);
	
	
	this.mithril.io.on("obj.object.del", function(path, params){ //untested
		for(var key in params)
		{	
			delete _this.playerCache.objectIds[params.objectId];  //may want to remove from other cache locations too.
		}
	}, true);


	this.mithril.io.on("obj.object.applyToObj", function(path, params){ //untested
		_this.playerCache.objectIds[params.id].appliedToObject = params.applyTo;
	}, true);


	this.mithril.io.on("obj.object.detachFromObj", function(path, params){ //untested
		_this.playerCache.objectIds[params.id].appliedToObject = null;
	}, true);


	this.mithril.io.on("obj.object.data.edit", function(path, params){
		for(var key in params.data)
		{
			_this.playerCache.objectIds[params.id].data[key] = params.data[key];
		}
	}, true);


	this.mithril.io.on("obj.object.data.del", function(path, params){ //untested
		for(var i=0;i<params.data.length;i++)
		{
			delete _this.playerCache.objectIds[params.id].data[params.data[i]];
		}
	}, true);


	// retrieve all actor's collections
	this.mithril.io.send('obj.getAllObjects', {}, function(errors, response) {
		if (errors) { return cb(errors); }

		// cache results
		_this.playerCache = {
			collections: [],
			objects: [],
			objectIds: {}
		};

		for (var objectId in response.objects)
		{
			_this.playerCache.objects.push(response.objects[objectId]);
		}
		_this.playerCache.objectIds = response.objects;

		for (var collectionId in response.collections)
		{
			var info = response.collections[collectionId];
			var collection = new MithrilGameModObj_Collection(info);

			var len = info.members.length;
			for (var i=0; i<len; i++)
			{
				var slot = info.members[i].slot
				var object = _this.getObject(info.members[i].id);
				collection.addObject(object, slot);
			}

			_this.playerCache.collections.push(collection);
		}

		cb();
	});
};


MithrilGameModObj.prototype.getObject = function(objectId)
{
	if (objectId in this.playerCache.objectIds)
	{
		return this.playerCache.objectIds[objectId];
	}
	return null;
};


MithrilGameModObj.prototype.getMyCollectionById = function(id)
{
	var result = [];

	var n = this.playerCache.collections.length;
	while (n--)
	{
		if (this.playerCache.collections[n].id == id) return this.playerCache.collections[n];
	}
	return null;
}

MithrilGameModObj.prototype.getMyCollectionsByType = function(type)
{
	var result = [];

	var n = this.playerCache.collections.length;
	while (n--)
	{
		if (this.playerCache.collections[n].type == type) result.push(this.playerCache.collections[n]);
	}
	return result;
};


// Collection logic

function MithrilGameModObj_Collection(collection)
{
	this.id = collection.collectionId;
	this.parent = collection.parentId;
	this.type = collection.collectionType;
	this.slotCount = collection.slotCount;
	this.maxWeight = collection.maxWeight;
	this.owner = collection.owner;
	this.objects = [];
}


MithrilGameModObj_Collection.prototype.addObject = function(object, slot)
{
	var info = { object: object };

	if (slot !== undefined && slot !== null)
	{
		info.slot = parseInt(slot);
	}

	this.objects.push(info);
};


MithrilGameModObj_Collection.prototype.delObject = function(objectId)
{
	var result = false;

	this.objects = this.objects.filter(function(info) {
		if (info.object.id != objectId)
		{
			return true;
		}

		result = true;
		return false;
	});

	return result;
};

/*MithrilGameModObj_Collection.prototype.delObjectBySlot = function(slot)
{
	this.objects = this.objects.filter(function(info) { return (info.slot != slot); });
};*/


MithrilGameModObj_Collection.prototype.getObject = function(objectId)
{
	var n = this.objects.length;
	while (n--)
	{
		if (this.objects[n].object.id == objectId) return this.objects[n];
	}
	return null;
};

MithrilGameModObj_Collection.prototype.getObjectByWeight = function(from, to)
{
	if (to == null) to = from;

	return this.objects.filter(function(info) { return (info.object.weight >= from && (info.object.weight <= to || to == "max")) });
};


MithrilGameModObj_Collection.prototype.contains = function(objectId)
{
	return this.objects.some(function(info) { return info.object.id == objectId; });
};

MithrilGameModObj_Collection.prototype.containsName = function(objectName)
{
	return this.objects.some(function(info) { return info.object.name.match(objectName); });
};

MithrilGameModObj_Collection.prototype.getObjectsByName = function(objectName)
{
	return this.objects.filter(function(info) { return info.object.name.match(objectName); });
};

MithrilGameModObj_Collection.prototype.getObjectBySlotNumber = function(slot)
{
	slot = parseInt(slot);

	var n = this.objects.length;
	while (n--)
	{
		if (this.objects[n].slot === slot) return this.objects[n];
	}
	return null;
};

MithrilGameModObj_Collection.prototype.uniqueNames = function()
{
	var unique = {};
	var names = [];
	this.objects.forEach(function(obj) {
		if (obj.object.name in unique)
			return;

		unique[obj.object.name] = null;
		names.push(obj.object.name);
	});
	return names;
};

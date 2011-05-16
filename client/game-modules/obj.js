function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}


MithrilGameModObj.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.on("obj.collection.object.add", function(path, params)
	{
		var collection = _this.mithril.obj.getMyCollectionById(params.collectionId)
		var len = collection.objects.length;

		for (var i=0;i<len;i++) //check there is nothing in this slot
		{
			if(collection.objects[i].slot == params.slot)
			{
				return false;
			}
		}
		if (collection.contains(params.objectId))
		{	//check this object is not already a member
			return false;
		}
		collection.addObject(_this.mithril.obj.getObjectById(params.objectId), params.slot);
	}, true);

	this.mithril.io.on("obj.collection.object.del", function(path, params)
	{
		var collection = _this.mithril.obj.getMyCollectionById(params.collectionId)
		var obj = null;

		if ('objectId' in params)
		{
			obj = collection.getObjectById(params.objectId);
		}
		else if ('slot' in params)
		{
			obj = collection.getObjectBySlotNumber(params.slot);
		}
		if (!obj) return false;
		params.slot = obj.slot;

		if (!collection.delObject(obj.object.id)) return false;
	}, true);

	this.mithril.io.on("obj.collection.add", function(path, params){
		var collection = new MithrilGameModObj_Collection(params);
		_this.playerCache.collections.push(collection);
	});

	this.mithril.io.on("obj.collection.del", function(path, params){ //untested
		_this.playerCache.collections = _this.playerCache.collections.filter(function(collection){
			if(collection.id != params.collectionId) { return true; } else { return false; }
		});
	});

	this.mithril.io.on("obj.collection.edit", function(path, params){
		for(var i=0;i<_this.playerCache.collections.length;i++) //untested
		{
			if(params.collectionId == _this.playerCache.collections[i].id)
			{
				if (collectionType in params) { _this.playerCache.collections[i].type = params.collectionType; }
				if (parent in params) { _this.playerCache.collections[i].parent = params.parent; }
				if (slotCount in params) { _this.playerCache.collections[i].slotCount = params.slotCount; }
				if (maxWeight in params) { _this.playerCache.collections[i].maxWeight = params.maxWeight; }
			}
		}
	});

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

	this.mithril.io.on("obj.collection.object", function(path, params){
	}, true);

	this.mithril.io.on("obj.collection", function(path, params){
	}, true);

	this.mithril.io.on("obj.object.edit", function(path, params){
		for(var key in params)  //untested
		{	//name,weight,id
			_this.playerCache.objectIds[params.id][key] = params[key];
		}
	}, true);

	this.mithril.io.on("obj.object.applyToObj", function(path, params){ //untested
		_this.playerCache.objectIds[params.id].appliedToObject = params.applyTo;
	}, true);

	this.mithril.io.on("obj.object.detachFromObj", function(path, params){ //untested
		_this.playerCache.objectIds[params.id].appliedToObject = null;
	}, true);

	this.mithril.io.on("obj.object.data.edit", function(path, params){ //untested
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

	this.mithril.io.on("obj", function(path, params){
	}, true);


	// retrieve all actor's collections

	this.mithril.io.send('obj.getAllObjects', {}, function(errors, response) {
		if (errors) { cb(errors); return; }

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
				var object = _this.getObjectById(info.members[i].id);
				collection.addObject(object, slot);
			}

			_this.playerCache.collections.push(collection);
		}

		// call cb
		cb(null);
	});
};


MithrilGameModObj.prototype.getObjectById = function(objectId)
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
	this.objects.push({ slot: parseInt(slot), object: object });
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


MithrilGameModObj_Collection.prototype.contains = function(objectId)
{
	return this.objects.some(function(info) { return info.object.id == objectId; });
};


MithrilGameModObj_Collection.prototype.containsName = function(objectName)
{
	return this.objects.some(function(info) { return info.object.name == objectName; });
};

MithrilGameModObj_Collection.prototype.getObjectBySlotNumber = function(slot)
{
	var n = this.objects.length;
	while (n--)
	{
		if (this.objects[n].slot == slot) return this.objects[n];
	}
	return null;
};

MithrilGameModObj_Collection.prototype.getObjectById = function(objectId)
{
	var n = this.objects.length;
	while (n--)
	{
		if (this.objects[n].object.id == objectId) return this.objects[n];
	}
	return null;
};


function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}


MithrilGameModObj.prototype.setup = function(cb)
{
	var _this = this;
	
	this.mithril.io.on("obj.collection.object.add", function(path, params){

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
	
	this.mithril.io.on("obj.collection.object.del", function(path, params){
		
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
	
	this.mithril.io.on("obj.collection.object", function(path, params){
		console.log(path, params);
	}, true);
	
	this.mithril.io.on("obj.collection", function(path, params){
		//console.log(path, params);
	}, true);
	
	this.mithril.io.on("obj", function(path, params){
		//console.log(path, params);
	}, true);

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


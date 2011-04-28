function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}


MithrilGameModObj.prototype.setup = function(cb)
{
	if (this.playerCache)
	{
		cb(null, this.playerCache);
		return;
	}

	var _this = this;

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
			for (var i=0;i<len;i++)
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


MithrilGameModObj.prototype.sysUpdate = function(data)
{
	console.log("data from event: ", data)
};


MithrilGameModObj.prototype.getObjectById = function(objectId)
{
	if (objectId in this.playerCache.objectIds)
	{
		return this.playerCache.objectIds[objectId];
	}
	return null;
};


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
	this.objects.push({ slot: slot, object: object });
};


MithrilGameModObj_Collection.prototype.delObject = function(objectId)
{
	this.objects = this.objects.filter(function(info) { return (info.object.id != objectId); });
};


MithrilGameModObj_Collection.prototype.contains = function(objectId)
{
	return this.objects.some(function(info) { return info.object.id == objectId; });
};


MithrilGameModObj_Collection.prototype.containsName = function(objectName)
{
	return this.objects.some(function(info) { return info.object.name == objectName; });
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


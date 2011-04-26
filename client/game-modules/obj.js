function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}

MithrilGameModObj.prototype.setup = function()
{
};

var loadPlayerCache = function(cb)
{
	this.mithril.io.send('obj.getAllObjects', {}, function(result) {
		cb(result.errors, result.response);
	});
};

MithrilGameModObj.prototype.getAllPlayerObjects = function(cb)
{
	if (this.playerCache)
	{
		cb(null, this.playerCache);
		return;
	}
	var _this = this;

	loadPlayerCache(function(errors, response) {
		if (errors) { cb(errors); return; }
		// cache results
		_this.playerCache = response;
		// call cb
		cb(null, _this.playerCache);
	});
};

MithrilGameModObj.prototype.getMyCollection = function(matchColType, cb)
{
	var _this = this;
	var returnData = null;
	
	this.mithril.obj.getAllPlayerObjects(function(err,cache)
	{
		if(err) { cb(err); return; }

		for (var key in cache.collections)
		{
			if(cache.collections[key].collectionType == matchColType)
			{
				returnData = cache.collections[key];
				for(var i=0;i<returnData.members.length;i++)
				{
					returnData.members[i] = cache.objects[returnData.members[i]];
				}
			}
		}
		cb(null, returnData)
	});
};



//var objects = getObjectsInCollection(getCollectionId('deck'))


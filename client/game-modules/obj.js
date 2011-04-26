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

MithrilGameModObj.prototype.getMyCollectionByType = function(matchColType, cb)
{
	var _this = this;
	
	this.mithril.obj.getAllPlayerObjects(function(err,cache)
	{
		if(err) { cb(err); return; }

		for (var key in cache.collections)
		{
			if(cache.collections[key].collectionType == matchColType)
			{
				cb(null, cache.collections[key]);
				return;				
			}
		}
	});
};

MithrilGameModObj.prototype.getObjectsByCollectionType = function(matchColType, cb)
{
	var _this = this;
	var objects = [];
	
	this.mithril.obj.getAllPlayerObjects(function(err,cache)
	{
		if(err) { cb(err); return; }

		for (var key in cache.collections)
		{
			if(cache.collections[key].collectionType == matchColType)
			{
				var members = cache.collections[key].members;
				for(var i=0;i<members.length;i++)
				{
					objects.push(cache.objects[members[i]])
				}
				cb(null, objects);
				return;
			}
		}
	});
};


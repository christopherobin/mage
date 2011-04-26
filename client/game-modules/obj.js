function MithrilGameModObj(mithril)
{
	this.mithril = mithril;
	this.playerCache = null;
}


MithrilGameModObj.prototype.setup = function()
{
};


var loadActorCache = function(actorId, cb)
{
	this.mithril.io.send('obj.getAllObjects', {}, function(result) {
		cb(result.errors, result.response);
	});
};

MithrilGameModObj.prototype.getAllActorObjects = function(cb)
{
	if (this.playerCache)
	{
		cb(null, this.playerCache);
		return;
	}

	var _this = this;

	this.loadActorCache(actorId, function(errors, response) {
		if (errors)
		{
			cb(errors);
		}
		else
		{	// cache results
			_this.playerCache = response;
			// call cb
			cb(null, _this.playerCache);
		}
	});
};

function MithrilGameModActor(mithril)
{
	this.mithril = mithril;
	this.me = {};
}


MithrilGameModActor.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.send('actor.getActor', { fields: ['name'] }, function(errors, result) {
		if (errors)
		{
			cb(errors);
		}
		else
		{
			_this.me.name = result.name;
			cb(null);
		}
	});
};


MithrilGameModActor.prototype.getActor = function(actorId, fields, cb)
{
	this.mithril.io.send('actor.getActor', { actorId: actorId, fields: fields }, cb);
};


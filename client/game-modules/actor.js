function MithrilGameModActor(mithril)
{
	this.mithril = mithril;
}


MithrilGameModActor.prototype.setup = function(cb)
{
	cb(null);
};


MithrilGameModActor.prototype.getActor = function(actorId, fields, cb)
{
	this.mithril.io.send('getActor', { actorId: actorId, fields: fields }, cb);
};


function MithrilGameModActor(mithril)
{
	this.mithril = mithril;
}


MithrilGameModActor.prototype.setup = function()
{
};


MithrilGameModActor.prototype.getActor = function(actorId, fields, cb)
{
	this.mithril.send('getActor', { actorId: actorId, fields: fields }, function(error, actor) {
		cb(error, actor);
	});
};


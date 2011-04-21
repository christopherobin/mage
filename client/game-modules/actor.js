function MithrilGameModActor(mithril)
{
	this.mithril = mithril;
}


MithrilGameModActor.prototype.setup = function()
{
};


MithrilGameModActor.prototype.getActor = function(actorId, fields, cb)
{
	this.mithril.io.send('getActor', { actorId: actorId, fields: fields }, function(result) {
		cb(result.errors, result.response);
	});
};


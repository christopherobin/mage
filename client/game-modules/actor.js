function MithrilGameModActor(mithril)
{
	this.mithril = mithril;
	this.me = {};
}


MithrilGameModActor.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.send('actor.sync', {}, function(errors, result) {
		if (errors) return cb(errors);

		_this.me = result.me;
		cb();
	});
};


MithrilGameModActor.prototype.getActor = function(actorId, fields, cb)
{
	this.mithril.io.send('actor.getActor', { actorId: actorId, fields: fields }, cb);
};


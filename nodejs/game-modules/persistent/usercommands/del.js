exports.execute = function(state, p, cb)
{
	mithril.persistent.del(state, p.properties, cb);
};

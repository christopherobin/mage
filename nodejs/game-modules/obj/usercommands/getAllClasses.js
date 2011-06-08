exports.execute = function(state, p, cb)
{
	state.respond(mithril.obj.getAllClasses(state.language(), p.behaviors, p.collapseValues));
	cb();
};


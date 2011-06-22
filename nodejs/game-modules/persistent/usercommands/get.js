exports.execute = function(state, p, cb)
{
	mithril.persistent.get(state, p.properties, p.removeAfterGet, function(error, data) {
		if (!error)
			state.respond(data);

		cb();
	});
};


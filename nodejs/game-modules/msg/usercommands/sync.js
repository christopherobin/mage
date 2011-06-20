exports.execute = function(state, p, cb)
{
	mithril.msg.loadInbox(state, state.actorId, function(error, inbox) {
		if (!error)
			state.respond({ inbox: inbox });

		cb();
	});
};


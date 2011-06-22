exports.execute = function(state, p, cb)
{
	mithril.player.getPlayer(state, state.actorId, ['language'], function(error, player) {
		if (!error)
			state.respond({ me: player });

		cb();
	});
};


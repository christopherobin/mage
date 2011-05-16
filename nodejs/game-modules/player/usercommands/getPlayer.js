exports.execute = function(state, p, cb)
{
	if (!p.playerId) p.playerId = state.session.playerId;

	mithril.player.getPlayer(state, p.playerId, p.fields, function(error, player) {
		if (error)
			state.error(1235);
		else
			state.respond(player);

		cb();
	});
};


var mithril = require('../../../mithril');


exports.params = ['search', 'limit', 'page'];


exports.execute = function (state, search, limit, page, cb) {
	mithril.player.getPlayers(state, search, limit, page, function (errors, players) {
		if (errors) {
			return cb(errors);
		}

		var objToJson = mithril.core.helpers.objToJson;

		var response = [];

		for (var i = 0, len = players.length; i < len; i++) {
			var player = players[i];
			var data = player.data;
			delete player.data;

			response.push(objToJson(player, { data: data.stringify() }));
		}

		state.respondJson('[' + response.join(',') + ']');
		cb();
	});
};

var mithril = require('../../mithril');
var async   = require('async');


// queryable model structure

var allowedFields = {
	playerId: 'id',
	vipLevel: 'vipLevel',
	language: 'language',
	lastLoginTime: 'lastLoginTime'
};

var joins = {
};


exports.getManageCommands = function () {
	return ['deletePlayer', 'editPlayer', 'getPlayers', 'getPlayerData'];
};

exports.getPlayer = function (state, id, fields, cb) {
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'player', joins) + ' WHERE actor = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.getLanguages = function (state, actorIds, cb) {
	var db = state.datasources.db;

	var sql = 'SELECT actor, language FROM player WHERE actor IN (' + db.getPlaceHolders(actorIds.length) + ')';
	var params = [].concat(actorIds);

	db.getMapped(sql, params, { key: 'actor', value: 'language' }, null, cb);
};


exports.getPlayerDetails = function (state, id, cb) {
	// TODO: Just grabbing actor stuff now, but eventually grab card collection and other detailed data
	mithril.actor.getActor(state, id, function (error, actor) {
		if (error) {
			return cb(error);
		}

		cb(null, actor);
	});
};


exports.getPlayers = function (state, cb) {
	// TODO: some kinda limit or pagination system needed (that or load 1000000000's of players at once)

	var sql = 'SELECT * FROM player';
	var params = [];

	state.datasources.db.getMany(sql, params, null, function (error, players) {
		if (error) {
			mithril.core.logger.error(error);
			return cb(error);
		}

		if (players.length === 0) {
			return cb(null, []);
		}

		var actorIds = [];
		var playerMap = {};

		for (var i = 0, len = players.length; i < len; i++) {
			var player = players[i];
			var actorId = player.actor;

			actorIds.push(actorId);
			playerMap[actorId] = player;
		}

		mithril.actor.getActorsProperties(state, actorIds, { loadAll: true }, function (error, maps) {
			if (error) {
				return cb(error);
			}

			for (var actorId in maps) {
				var player = playerMap[actorId];
				if (player) {
					player.data = maps[actorId];
				}
			}

			cb(null, players);
		});
	});
};


exports.addPlayer = function (state, actorId, vipLevel, language, cb) {
	var lastLoginTime = mithril.core.time;

	var sql = 'INSERT INTO player(actor, vipLevel, language, lastLoginTime) VALUES(?, ?, ?, ?)';
	var params = [actorId, vipLevel, language, lastLoginTime];

	state.datasources.db.exec(sql, params, null, function (err) {
		if (err) {
			return cb(err);
		}

		cb(null, { playerId: actorId, vipLevel: vipLevel, language: language, lastLoginTime: lastLoginTime });
	});
};


exports.setVipLevel = function (state, playerId, vipLevel, cb) {
	var sql = 'UPDATE player SET vipLevel = ? WHERE actor = ?';
	var params = [vipLevel, playerId];

	state.datasources.db.exec(sql, params, null, cb);
};


exports.setLoggedIn = function (state, playerId, cb) {
	var lastLoginTime = mithril.core.time;

	var sql = 'UPDATE player SET lastLoginTime = ? WHERE actor = ?';
	var params = [lastLoginTime, playerId];

	state.datasources.db.exec(sql, params, null, function (err) {
		if (err) {
			return cb(err);
		}

		cb(null, { playerId: playerId, lastLoginTime: lastLoginTime });
	});
};


var mithril = require('../../mithril');
var async   = require('async');


// queryable model structure

var allowedFields = {
	playerId: 'id',
	vipLevel: 'vipLevel'
};

var joins = {
};


exports.getManageCommands = function () {
	return ['getPlayers', 'sync'];
};

exports.getPlayer = function (state, id, fields, cb) {
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'player', joins) + ' WHERE actor = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, cb);
};


/**
 *
 * @param state
 * @param ids
 * @param options
 * @param limit
 * @param page
 * @param cb
 */

exports.getPlayers = function (state, ids, options, limit, page, cb) {
	var sql = 'SELECT actor, vipLevel FROM player';
	var params = [];
	var start = 0;

	if (page) {
		start = (page - 1) * limit + 1;
	}

	if (!limit) {
		limit = 100;
	}

	if (ids) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}

		sql += ' WHERE actor IN (' + state.datasources.db.getPlaceHolders(ids.length) + ')';
		params = params.concat(ids);

	}

	sql += ' LIMIT ' + start + ', ' + (start + limit);

	state.datasources.db.getMany(sql, params, null, function (error, players) {
		if (error) {
			return cb(error);
		}

		var len = players.length;

		if (len === 0) {
			return cb(null, []);
		}

		var actorIds = [];
		var playerMap = {};

		for (var i = 0; i < len; i++) {
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


exports.addPlayer = function (state, actorId, vipLevel, cb) {
	var sql = 'INSERT INTO player(actor, vipLevel) VALUES(?, ?)';
	var params = [actorId, vipLevel];

	state.datasources.db.exec(sql, params, null, function (err) {
		if (err) {
			return cb(err);
		}

		cb(null, { playerId: actorId, vipLevel: vipLevel });
	});
};


exports.setVipLevel = function (state, playerId, vipLevel, cb) {
	var sql = 'UPDATE player SET vipLevel = ? WHERE actor = ?';
	var params = [vipLevel, playerId];

	state.datasources.db.exec(sql, params, null, cb);
};


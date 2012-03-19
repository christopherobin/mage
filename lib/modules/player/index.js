var mithril = require('../../mithril');
var async   = require('async');


// queryable model structure

var allowedFields = {
	playerId: 'id',
	vipLevel: 'vipLevel',
	lastLoginTime: 'lastLoginTime'
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
	var sql = 'SELECT p.* FROM player AS p';
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
		sql += ' WHERE p.actor IN (' + state.datasources.db.getPlaceHolders(ids.length) + ')';
		params = params.concat(ids);

	}

	if (options) {
		sql += ' JOIN actor_data AS act ON act.actor = p.actor WHERE';
		var multi = false;

		for (var key in options) {
			sql += ((multi) ? ' AND ' : ' ') + 'act.property = ? AND act.value LIKE ?';
			multi = true;
			params.push(key);
			params.push('%' + options[key] + '%');
		}
	}

	sql += ' LIMIT ' + start + ', ' + (start + limit);

	state.datasources.db.getMany(sql, params, null, function (error, players) {
		if (error) {
			mithril.core.logger.error(error);
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


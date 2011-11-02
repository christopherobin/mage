var mithril = require('../../mithril');
var async   = require('async');

exports.sessions = require('./sessions');


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
	// TODO: some kinda limit or pagination system needed (that or load 1000000000's of players at once
	var sql = 'SELECT * FROM player';
	state.datasources.db.getMany(sql, [], null, function (error, players) {
		if (error) {
			mithril.core.logger.error(error);
			return cb(error);
		}

		async.forEachSeries(players, function (player, callback) {
			mithril.actor.getProperties(state, player.actor, [], function (errors, data) {
				if (errors) {
					return callback(errors);
				}

				if (data) {
					player.data = data;
					callback(null, player);
				}
			});
		}, function (error) {
			if (error) {
				return cb(error);
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


exports.delPlayer = function (state, playerId, cb) {
	var sql = 'DELETE FROM player WHERE actor = ?';
	var params = [playerId];

	state.datasources.db.exec(sql, params, null, cb);
};


// Deletes actor and all purchase history relating to that player
exports.delPlayerActor = function (state, params, cb) {
	async.series([
		function (callback) {
			var sql = 'DELETE FROM shop_purchase WHERE playerId = ? OR forActorId = ?';
			state.datasources.db.exec(sql, [params.id, params.id], null, function (errors) {
				if (errors) {
					return cb(errors);
				}

				callback();
			});
		},
		function (callback) {
			var sql = 'DELETE FROM actor WHERE id = ?';
			state.datasources.db.exec(sql, [params.id], null, function (errors) {
				if (errors) {
					return cb(errors);
				}

				callback();
			});
		}
	], cb);
};


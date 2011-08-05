var mithril = require('../../mithril');

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


exports.getPlayer = function(state, id, fields, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'player', joins) + ' WHERE actor = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.addPlayer = function(state, actorId, vipLevel, language, cb)
{
	var lastLoginTime = mithril.core.time;

	var sql = 'INSERT INTO player(actor, vipLevel, language, lastLoginTime) VALUES(?, ?, ?, ?)';
	var params = [actorId, vipLevel, language, lastLoginTime];

	state.datasources.db.exec(sql, params, null, function(err) {
		if (err) { return cb(err); }

		cb(null, { playerId: actorId, vipLevel: vipLevel, language: language, lastLoginTime: lastLoginTime });
	});
};


exports.setVipLevel = function(state, playerId, vipLevel, cb)
{
	var sql = 'UPDATE player SET vipLevel = ? WHERE actor = ?';
	var params = [vipLevel, playerId];

	state.datasources.db.exec(sql, params, null, cb);
};


exports.setLoggedIn = function(state, playerId, cb)
{
	var lastLoginTime = mithril.core.time;

	var sql = 'UPDATE player SET lastLoginTime = ? WHERE actor = ?';
	var params = [lastLoginTime, playerId];

	state.datasources.db.exec(sql, params, null, function(err) {
		if (err) return cb(err);

		cb(null, { playerId: playerId, lastLoginTime: lastLoginTime });
	});
};


exports.delPlayer = function(state, playerId, cb)
{
	var sql = 'DELETE FROM player WHERE actor = ?';
	var params = [playerId];

	state.datasources.db.exec(sql, params, null, cb);
};


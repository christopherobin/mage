exports.userCommands = {
	getPlayer: __dirname + '/usercommands/getPlayer.js'
};

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

	var query = 'INSERT INTO player(actor, vipLevel, language, lastLoginTime) VALUES(?, ?, ?, ?)';
	var params = [actorId, vipLevel, language, lastLoginTime];

	state.datasources.db.exec(query, params, null, function(err) {
		if (err)
		{
			cb(err);
		}
		else
		{
			cb(null, { playerId: actorId, vipLevel: vipLevel, language: language, lastLoginTime: lastLoginTime });
		}
	});
};


exports.setVipLevel = function(state, playerId, vipLevel, cb)
{
	var query = 'UPDATE player SET vipLevel = ? WHERE actor = ?';
	var params = [vipLevel, playerId];

	state.datasources.db.exec(query, params, null, cb);
};


exports.setLoggedIn = function(state, playerId, cb)
{
	var lastLoginTime = mithril.core.time;

	var query = 'UPDATE player SET lastLoginTime = ? WHERE actor = ?';
	var params = [lastLoginTime, playerId];

	state.datasources.db.exec(query, params, null, function(err) {
		if (err) return cb(err);

		cb(null, { playerId: playerId, lastLoginTime: lastLoginTime });
	});
};


exports.delPlayer = function(state, playerId, cb)
{
	var query = 'DELETE FROM player WHERE actor = ?';
	var params = [playerId];

	state.datasources.db.exec(query, params, null, cb);
};


exports.sessions = require('./sessions.js');


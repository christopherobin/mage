var errors = {
	PLAYER_NOTFOUND:    { module: 'player', code: 1000, log: { msg: 'Player not found.', method: 'error' } },
	PLAYER_ADD_FAILED:  { module: 'player', code: 1001, log: { msg: 'Player creation failed.', method: 'error' } },
	PLAYER_EDIT_FAILED: { module: 'player', code: 1002, log: { msg: 'Player update failed.', method: 'error' } },
	PLAYER_DEL_FAILED:  { module: 'player', code: 1003, log: { msg: 'Player deletion failed.', method: 'error' } }
};

exports.errors = errors;


// queryable model structure

var allowedFields = {
	playerId: 'id',
	vipLevel: 'vipLevel',
	lastLoginTime: 'lastLoginTime'
};

var joins = {
};


exports.getPlayer = function(state, id, fields, state, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'player', joins) + ' WHERE actor = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, errors.PLAYER_NOTFOUND, cb);
};


exports.addPlayer = function(state, actorId, vipLevel, lastLoginTime, cb)
{
	var query = 'INSERT INTO player(actor, vipLevel, lastLoginTime) VALUES(?, ?, ?)';
	var params = [actorId, vipLevel, lastLoginTime];

	state.datasources.db.exec(query, params, errors.PLAYER_ADD_FAILED, function(err) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			if (cb) cb(null, { playerId: actorId, vipLevel: vipLevel, lastLoginTime: lastLoginTime });
		}
	});
};


exports.setVipLevel = function(state, playerId, vipLevel, cb)
{
	var query = 'UPDATE player SET vipLevel = ? WHERE actor = ?';
	var params = [vipLevel, playerId];

	state.datasources.db.exec(query, params, errors.PLAYER_UPDATE_FAILED, cb);
};


exports.setLoggedIn = function(state, playerId, cb)
{
	var lastLoginTime = mithril.time;

	var query = 'UPDATE player SET lastLoginTime = ? WHERE actor = ?';
	var params = [lastLoginTime, playerId];

	state.datasources.db.exec(query, params, errors.PLAYER_UPDATE_FAILED, function(err) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			if (cb) cb(null, { playerId: playerId, lastLoginTime: lastLoginTime });
		}
	});
};


exports.delPlayer = function(state, playerId, cb)
{
	var query = 'DELETE FROM player WHERE actor = ?';
	var params = [playerId];

	state.datasources.db.exec(query, params, error.PLAYER_DEL_FAILED, cb);
};


exports.session = require('./session.js');


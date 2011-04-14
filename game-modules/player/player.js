var errors = {
	PLAYER_NOTFOUND: { module: 'player', code: 1000, log: { msg: 'Player not found.', method: 'error' } }
};

exports.errors = errors;

/*
Player.prototype.load = function(state, cb)
{
	var query  = 'SELECT vipLevel, creationTime, lastLoginTime, nickname FROM player WHERE id = ?';
	var params = [this.id];

	app.util.loadObjectFromDb(this, state, query, params, errors.PLAYER_NOTFOUND, cb);
};


exports.load = function(ids, state, cb)
{
	var query  = 'SELECT id, vipLevel, creationTime, lastLoginTime, nickname FROM player WHERE id IN (' + ids.map(function() { return '?'; }).join(', ') + ')';

	app.util.loadObjectsFromDb(Player, state, query, ids, errors.PLAYER_NOTFOUND, cb);
};
*/

var playerFields = ['id', 'vipLevel', 'creationTime', 'lastLoginTime', 'nickname'];

function sanitizeFields(fields)
{
	return fields.filter(function(field) { return playerFields.indexOf(field) > -1; });
}


exports.getPlayer = function(id, fields, state, cb)
{
	var query = 'SELECT '.sanitizeFields(fields).join(', ').' FROM player WHERE id = ?';

	state.datasources.loadObjectFromDb(query, [id], errors.PLAYER_NOTFOUND, cb);
};


exports.Player = Player;
exports.session = require('./session.js');


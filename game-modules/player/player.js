var errors = {
	PLAYER_NOTFOUND: { module: 'player', code: 1000, log: { msg: 'Player not found.', method: 'error' } }
};

exports.errors = errors;


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


//Game specific playerstate module for Tengoku Summoners - TF April 2011

var errors = {
	ERROR_CONST: { module: 'playerstate', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

var joins = {
	playerStatePlayer:	{ sql: 'INNER JOIN player AS ? ON game_playerstate.player = ?.id' },
	playerStateActor:	{ sql: 'INNER JOIN actor AS ? ON game_playerstate.player = ?.id', }
};

var allowedFields = {
	playerId:           'player',
	xp:          		'xp',
	level:				'level',
	stamina:			'stamina',
	maxStamina:			'maxStamina',
	pvpStamina:			'pvpStamina',
	maxPvpStamina:		'maxPvpStamina',
	playerName:			['playerStateActor', 'name'],
	creationTime:	  	['playerStateActor', 'creationTime'],
	vipLevel:		  	['playerStatePlayer', 'vipLevel'],
};

exports.addGamePlayer = function addGamePlayer(state, name, xp, level, stamina, maxStamina, pvpStamina, maxPvpStamina, cb)
{	//this may warrant a transaction
	mithril.actor.addActor(state, name, function(err,actorData){
		if (err) { cb(err); }
		else
		{
			mithril.player.addPlayer(state, actorData.actorId, 0, function(err,playerData){
				if (err) { cb(err); }
				else
				{
					var query = "INSERT INTO game_playerstate (player, xp, level, stamina, maxStamina, pvpStamina, maxPvpStamina) VALUES ( ?, ?, ?, ?, ?, ?, ? )";
					state.datasources.db.exec(query, [playerData.playerId, xp, level, stamina, maxStamina, pvpStamina, maxPvpStamina], errors.ERROR_CONST, function(err, info) {
						if (err) { cb(err); }
						else
						{
							cb(null, { id: info.insertId, xp:xp, level:level, stamina:stamina, maxStamina:maxStamina, pvpStamina:pvpStamina, maxPvpStamina:maxPvpStamina });
						}
					});
				}
			});
		}
	});
};

exports.editGamePlayer = function editGamePlayer(state, playerId, data, cb)
{	// data = {field:value} object
	var sql = "UPDATE game_playerstate SET "
	var params = [];
	
	for (var key in data)
	{
		if(key in allowedFields && !(allowedFields[key] instanceof Array)) //rejects update of anything other than values on primary table.
		{
			sql += key + " = ? ,";
			params.push(data[key]);
		}
	}
	sql = sql.substr(0,sql.length-2);
	sql += " WHERE player = ?";

	params.push(playerId);
	state.datasources.db.exec(sql, params, errors.ERROR_CONST, cb);
};

exports.getGamePlayer = function getGamePlayer(state, playerId, fields, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'game_playerstate', joins) + ' WHERE player = ?';
	var params = [playerId];

	state.datasources.db.getOne(query, params, true, errors.ERROR_CONST, cb);
}



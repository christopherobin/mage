exports.userCommands = {
	getActor: __dirname + '/usercommands/getActor.js'
};


// queryable model structure

var allowedFields = {
	actorId: 'id',
	creationTime: 'creationTime',
	name: 'name'
};

var joins = {
};


exports.getActor = function(state, id, fields, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'actor', joins) + ' WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.addActor = function(state, name, cb)
{
	var time = mithril.core.time;

	var query = 'INSERT INTO actor (name, creationTime) VALUES (?, ?)';
	var params = [name, time];

	state.datasources.db.exec(query, params, null, function(error, info) {
		if (error) return cb(error);

		cb(null, { actorId: info.insertId, creationTime: time, name: name });
	});
};


exports.setActorName = function(state, id, name, cb)
{
	var query = 'UPDATE actor SET name = ? WHERE id = ?';
	var params = [name, id];

	state.datasources.db.exec(query, params, null, cb);
};


exports.delActor = function(state, id, cb)
{
	var query = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(query, params, null, cb);
};


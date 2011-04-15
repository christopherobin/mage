var errors = {
	ACTOR_NOTFOUND: { module: 'actor', code: 1000, log: { msg: 'Actor not found.', method: 'error' } },
	ACTOR_ADD_FAILED: { module: 'actor', code: 1001, log: { msg: 'Actor creation failed.', method: 'error' } },
	ACTOR_EDIT_FAILED: { module: 'actor', code: 1002, log: { msg: 'Actor update failed.', method: 'error' } },
	ACTOR_DEL_FAILED: { module: 'actor', code: 1003, log: { msg: 'Actor deletion failed.', method: 'error' } }
};

exports.errors = errors;


// queryable model structure

var allowedFields = {
	actorId: 'id',
	creationTime: 'creationTime',
	name: 'name'
};

var joins = {
};


exports.getActor = function(id, fields, state, cb)
{
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'actor', joins) + ' WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, errors.ACTOR_NOTFOUND, cb);
};


exports.addActor = function(state, creationTime, name, cb)
{
	var time = mithril.time;

	var query = 'INSERT INTO actor VALUES(NULL, ?, ?)';
	var params = [name, time];

	state.datasources.db.exec(query, params, error.ACTOR_ADD_FAILED, function(err, info) {
		if (err)
			cb(err);
		else
			cb(null, { actorId: info.insertId, creationTime: time, name: name });
	});
};


exports.setActorName = function(state, id, name, cb)
{
	var query = 'UPDATE actor SET name = ? WHERE id = ?';
	var params = [name, id];

	state.datasources.db.exec(query, params, error.ACTOR_EDIT_FAILED, cb);
};


exports.delActor = function(state, id, cb)
{
	var query = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(query, params, error.ACTOR_DEL_FAILED, cb);
};


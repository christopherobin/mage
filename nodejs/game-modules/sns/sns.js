// Social Networking Services Module.

exports.userCommands = {
	sync:				__dirname + '/usercommands/sync.js',
	requestRelation: 	__dirname + '/usercommands/requestRelation.js',
	delRelationRequest:	__dirname + '/usercommands/delRelationRequest.js',
	delRelation: 		__dirname + '/usercommands/delRelation.js'
};

var types = {};


exports.setup = function(state, cb)
{
	types = (mithril.core.config.module && mithril.core.config.module.sns && mithril.core.config.module.sns.relationTypes) ? mithril.core.config.module.sns.relationTypes : {};
	cb();
};


exports.getRelationRequests = function(state, type, actorId, targetActorId, cb)
{
	// returns all relation requests of type "type" from actorId to targetActorId.
	// if type is omitted, relation requests of any type are returned.
	// if actorId is omitted, all relation requests to targetActorId will be returned.
	// if targetActorId is omitted, all relation requests from actorId will be returned.

	var query = 'SELECT id, type, actor, targetActor, creationTime FROM sns_relationrequest';
	var where = [];
	var params = [];

	if (type)
	{
		where.push('type = ?');
		params.push(type);
	}
	if (actorId)
	{
		where.push('actor = ?');
		params.push(actorId);
	}
	if (targetActorId)
	{
		where.push('targetActor = ?');
		params.push(targetActorId);
	}
	if (where.length > 0)
	{
		query += ' WHERE ' + where.join(' AND ');
	}
	state.datasources.db.getMany(query, params, null, cb);
};


exports.relationRequestExists = function(state, type, actorId, targetActorId, cb)
{
	// Returns true if a relation request for this type and these actors exists. False otherwise.

	exports.getRelationRequests(state, type, actorId, targetActorId, function(error, results) {
		if (error) return cb(error);

		if (results.length > 0)
		{
			cb(null, results[0]);
		}
		else
			cb(null, false);
	});
};


exports.getRelationRequest = function(state, requestId, cb)
{
	// returns a relation request by ID.

	var query = 'SELECT id, type, actor, targetActor, creationTime FROM sns_relationrequest WHERE id = ?';
	var params = [requestId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.requestRelation = function(state, type, actorId, targetActorId, cb)
{
	// Registers/Accepts a relation request.
	// If it's a bidirectional relation type and the other actor also requested this type of relation, instantly connect the two actors instead.
	// If this relation type does not require approval, also instantly connect the two actors.

	if (!types[type]) return state.error(null, 'Unknown relation type: ' + type, cb);
	if (!targetActorId) return state.error(null, 'Invalid target Actor: ' + targetActorId, cb);

	// TODO: If this type of relation already exists, throw an error. Make sure that the bidirectionality is checked.

	if (!types[type].requiresApproval)
	{
		// immediately connect
		exports.createRelation(state, type, actorId, targetActorId, cb);
	}
	else
	{
		if (types[type].bidirectional)
		{
			// if targetActor has already issued a relation request of this type, auto-connect

			exports.relationRequestExists(state, type, targetActorId, actorId, function(error, exists) {
				if (error) return cb(error);

				if (exists)
				{
					exports.delRelationRequest(state, exists.id, function(error) {
						if (error) return cb(error);

						exports.createRelation(state, type, actorId, targetActorId, cb);
					});
				}
				else
					createRelationRequest(state, type, actorId, targetActorId, cb);
			});
		}
		else
		{
			// unidirectional, so just create the request

			createRelationRequest(state, type, actorId, targetActorId, cb);
		}
	}
};


exports.delRelationRequest = function(state, requestId, cb)
{
	// drop the request
	// emit event to actor and targetActor

	exports.getRelationRequest(state, requestId, function(error, request) {
		if (error) return cb(error);

		var sql = 'DELETE FROM sns_relationrequest WHERE id = ?';
		var params = [requestId];

		state.datasources.db.exec(sql, params, null, function(error, info) {
			if (error) return cb(error);

			state.emit(request.actor,       'sns.relationrequest.del', { id: requestId, actorId: request.targetActor });
			state.emit(request.targetActor, 'sns.relationrequest.del', { id: requestId, actorId: request.actor });

			cb();
		});
	});
};


function createRelationRequest(state, type, actorId, targetActorId, cb)
{
	// directly creates a relation request, without condition checks
	// Emit event to actor and targetActor

	var time = mithril.core.time;

	var sent = {
		type: type,
		toActor: targetActorId,
		creationTime: time
	};

	var received = {
		type: type,
		fromActor: actorId,
		creationTime: time
	};

	var sql = 'INSERT INTO sns_relationrequest VALUES(NULL, ?, ?, ?, ?)';
	var params = [type, actorId, targetActorId, time];

	state.datasources.db.exec(sql, params, null, function(error, info) {
		if (error) return cb(error);

		sent.id = received.id = info.insertId;

		state.emit(actorId,       'sns.relationrequest.outbox.add', sent);
		state.emit(targetActorId, 'sns.relationrequest.inbox.add',  received);

		cb();
	});
}


exports.getRelations = function(state, type, actorId, cb)
{
	// returns all relations where actorA or actorB is actorId
	// type is optional

	var query = 'SELECT id, type, IF(actorA = ?, actorB, actorA) AS actorId, creationTime FROM sns_relation WHERE ? IN (actorA, actorB)';
	var params = [actorId, actorId];

	if (type)
	{
		query += ' AND type = ?';
		params.push(type);
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getRelation = function(state, relationId, cb)
{
	var query = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation WHERE id = ?';
	var params = [relationId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.findRelation = function(state, type, actorA, actorB, cb)
{
	if (!types[type]) return state.error(null, 'Unknown relation type: ' + type, cb);

	// if bi-directional, swap actors, check both possibilities

	var query;
	var params;

	if (types[type].bidirectional)
	{
		query = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation WHERE type = ? AND (actorA = ? AND actorB = ?) OR (actorA = ? AND actorB = ?)';
		params = [type, actorA, actorB, actorB, actorA];
	}
	else
	{
		query = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation WHERE type = ? AND actorA = ? AND actorB = ?';
		params = [type, actorA, actorB];
	}

	state.datasources.db.getOne(query, params, false, null, cb);
};


exports.getRelationsFromActor = function(state, type, actorId, cb)
{
	// gets all relations where actorA is actorId
	// type is optional

	var query = 'SELECT id, type, actorB AS actor, creationTime FROM sns_relation WHERE actorA = ?';
	var params = [actorId];

	if (type)
	{
		query += ' AND type = ?';
		params.push(type);
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getRelationsToActor = function(state, type, actorId, cb)
{
	// gets all relations where actorB is actorId
	// type is optional

	var query = 'SELECT id, type, actorA AS actor, creationTime FROM sns_relation WHERE actorB = ?';
	var params = [actorId];

	if (type)
	{
		query += ' AND type = ?';
		params.push(type);
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.createRelation = function(state, type, actorA, actorB, cb)
{
	// Create a relation between 2 actors
	// Delete any existing requests
	// Emit event to both actors
	// This function may be called externally, but should not be needed.
	// Normal flow would use requestRelation()

	if (!types[type]) return state.error(null, 'Unknown relation type: ' + type, cb);

	var time = mithril.core.time;

	var internal = { type: type };

	var forA = {
		type: type,
		creationTime: time
	};

	var forB = {
		type: type,
		creationTime: time
	};

	if (types[type].bidirectional)
	{
		forA.actorId = actorB;
		forB.actorId = actorA;

		internal.actorA = actorA;
		internal.actorB = actorB;
	}
	else
	{
		forB.from = actorA;
		forA.to = actorB;

		internal.from = actorA;
		internal.to = actorB;
	}

	exports.emit('relationCreated', [state, internal], function(error) {
		if (error) return cb(error);

		var sql = 'INSERT INTO sns_relation VALUES(NULL, ?, ?, ?, ?)';
		var params = [type, actorA, actorB, time];

		state.datasources.db.exec(sql, params, null, function(error, info) {
			if (error) return cb(error);

			forA.id = forB.id = info.insertId;

			// events that describe the new relation

			state.emit(actorA, 'sns.relation.add', forA);
			state.emit(actorB, 'sns.relation.add', forB);

			cb(null, info);
		});
	});
};


exports.delRelation = function(state, relationId, cb)
{
	// drop the relation
	// emit event to both actors

	exports.getRelation(state, relationId, function(error, relation) {
		if (error) return cb(error);

		var internal = { type: relation.type, actorA: relation.actorA, actorB: relation.actorB };

		exports.emit('relationDeleted', [state, internal], function(error) {
			if (error) return cb(error);

			var sql = 'DELETE FROM sns_relation WHERE id = ?';
			var params = [relationId];

			state.datasources.db.exec(sql, params, null, function(error) {
				if (error) return cb(error);

				state.emit(relation.actorA, 'sns.relation.del', { id: relationId });
				state.emit(relation.actorB, 'sns.relation.del', { id: relationId });

				cb();
			});
		});
	});
};

exports.resetRelation = function(state, relationId, cb)
{
	// TODO: drop data table here too once implemented
	// TODO: emit event to the players involved to reset anything that got reset (currently only creationTime)

	var time = mithril.core.time;
	var sql = "UPDATE sns_relation SET creationTime = ? WHERE id = ?";
	var params = [time, relationId];
	state.datasources.db.exec(sql, params, null, cb);
};


// Social Networking Services Module.

var mithril = require('../../mithril');

var types = {};


exports.setup = function (state, cb) {
	types = mithril.core.config.get('module.sns.relationTypes') || {};
	cb();
};


exports.getRelationRequests = function (state, options, cb) {
	// returns all relation requests
	// options.type will filter on relation type
	// options.actorId will return all requests where actorId is involved
	// options.fromActorId will return all requests from fromActorId
	// options.toActorId will return all requests to toActorId

	options = options || {};

	var query = 'SELECT id, type, fromActorId, toActorId, creationTime FROM sns_relationrequest';
	var where = [];
	var params = [];

	var actorIds = options.actorId ? [options.actorId] : options.actorIds;

	if (actorIds) {
		for (var i = 0, len = actorIds.length; i < len; i++) {
			where.push('(fromActorId = ? OR toActorId = ?)');
			params.push(actorIds[i], actorIds[i]);
		}

		// We will need a subquery to check for type, because of the crappy MySQL optimizer not using indexes
		// otherwise. This is because of the previous OR operation.

		if (options.type) {
			where.push('id IN (SELECT id FROM sns_relationrequest WHERE type = ?)');
			params.push(options.type);
		}
	} else {
		if (options.type) {
			where.push('type = ?');
			params.push(options.type);
		}
	}

	if (options.fromActorId) {
		where.push('fromActorId = ?');
		params.push(options.fromActorId);
	}

	if (options.toActorId) {
		where.push('toActorId = ?');
		params.push(options.toActorId);
	}

	if (where.length > 0) {
		query += ' WHERE ' + where.join(' AND ');
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.relationRequestExists = function (state, type, fromActorId, toActorId, cb) {
	// Returns true if a relation request for this type and these actors exists. False otherwise.

	var options = {
		type: type,
		fromActorId: fromActorId,
		toActorId: toActorId
	};

	exports.getRelationRequests(state, options, function (error, results) {
		if (error) {
			return cb(error);
		}

		cb(null, results[0] || false);
	});
};


exports.getRelationRequest = function (state, requestId, cb) {
	// returns a relation request by ID.

	var query = 'SELECT id, type, fromActorId, toActorId, creationTime FROM sns_relationrequest WHERE id = ?';
	var params = [requestId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


function createRelationRequest(state, type, fromActorId, toActorId, cb) {
	// directly creates a relation request, without condition checks
	// Emit event to both actors

	fromActorId = (fromActorId >>> 0);
	toActorId   = (toActorId >>> 0);

	var time = mithril.core.time;

	var request = {
		type: type,
		fromActorId: fromActorId,
		toActorId: toActorId,
		creationTime: time
	};

	exports.emit('relationRequested', [state, request], function (error) {
		if (error) {
			return cb(error);
		}

		var sql = 'INSERT INTO sns_relationrequest VALUES(NULL, ?, ?, ?, ?)';
		var params = [type, fromActorId, toActorId, time];

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			request.id = info.insertId;

			state.emit(fromActorId, 'sns.relationrequest.add', request);
			state.emit(toActorId,   'sns.relationrequest.add', request);

			cb();
		});
	});
}


exports.requestRelation = function (state, type, fromActorId, toActorId, cb) {
	// Registers/Accepts a relation request.
	// If it's a bidirectional relation type and the other actor also requested this type of relation, instantly connect the two actors instead.
	// If this relation type does not require approval, also instantly connect the two actors.

	if (!types[type]) {
		return state.error(null, 'Unknown relation type: ' + type, cb);
	}

	fromActorId = (fromActorId >>> 0);
	toActorId   = (toActorId >>> 0);

	if (!fromActorId) {
		return state.error(null, 'Invalid source actor: ' + fromActorId, cb);
	}

	if (!toActorId) {
		return state.error(null, 'Invalid target actor: ' + toActorId, cb);
	}


	if (!types[type].requiresApproval) {
		// immediately connect
		// createRelation does a check to see if it already exists, so we do not have to do that here

		exports.createRelation(state, type, fromActorId, toActorId, cb);
	} else {
		// If this type of relation already exists, throw an error. Make sure that the bidirectionality is checked.

		exports.findRelation(state, type, fromActorId, toActorId, function (error, existingRelation) {
			if (error) {
				return cb(error);
			}

			if (existingRelation) {
				return state.userError('relationExists', cb);
			}

			// the relation does not yet exist, let's create it
			// find out about existing relation requests between these 2 actors

			var options = { type: type, actorIds: [fromActorId, toActorId] };

			exports.getRelationRequests(state, options, function (error, requests) {
				if (error) {
					return cb(error);
				}

				// if the request already exists, fail

				var i, len = requests.length;
				var exists = false, autoConnect = false;

				for (i = 0; i < len; i++) {
					var request = requests[i];

					if (request.fromActorId === fromActorId) {
						exists = true;
					}

					// if targetActor has already issued a relation request of this type, and we're bidirectional, auto-connect

					if (types[type].bidirectional && request.fromActorId === toActorId) {
						autoConnect = request.id;
					}
				}

				if (exists) {
					return state.userError('requestExists', cb);
				}

				if (autoConnect) {
					// autoConnect holds the relation request ID that needs to be removed

					exports.delRelationRequest(state, autoConnect, function (error) {
						if (error) {
							return cb(error);
						}

						exports.createRelation(state, type, fromActorId, toActorId, cb);
					});
				} else {
					// there's no request yet -> create it

					createRelationRequest(state, type, fromActorId, toActorId, cb);
				}
			});
		});
	}
};


exports.delRelationRequest = function (state, requestId, cb) {
	// drop the request
	// emit event to actor and targetActor

	requestId = ~~requestId;

	exports.getRelationRequest(state, requestId, function (error, request) {
		if (error) {
			return cb(error);
		}

		var sql = 'DELETE FROM sns_relationrequest WHERE id = ?';
		var params = [requestId];

		state.datasources.db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			state.emit(request.fromActorId, 'sns.relationrequest.del', { id: requestId });
			state.emit(request.toActorId,   'sns.relationrequest.del', { id: requestId });

			cb();
		});
	});
};


exports.getRelations = function (state, options, cb) {
	// returns all relations
	// options.type will filter on relation type
	// options.actorId will return all relations where actorId is involved
	// options.actorIds will return all relations where both actorIds are involved
	// options.fromActorId will return all relations from fromActorId
	// options.toActorId will return all relations to toActorId

	// returns all relations where actorA or actorB is actorId
	// type is optional

	var sql = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation';
	var params = [];
	var where = [];

	var actorIds = options.actorId ? [options.actorId] : options.actorIds;

	if (actorIds) {
		for (var i = 0, len = actorIds.length; i < len; i++) {
			where.push('(actorA = ? OR actorB = ?)');
			params.push(actorIds[i], actorIds[i]);
		}

		// We will need a subquery to check for type, because of the crappy MySQL optimizer not using indexes
		// otherwise. This is because of the previous OR operation.

		if (options.type) {
			where.push('id IN (SELECT id FROM sns_relation WHERE type = ?)');
			params.push(options.type);
		}
	} else {
		if (options.type) {
			where.push('type = ?');
			params.push(options.type);
		}
	}

	if (options.fromActorId) {
		where.push('actorA = ?');
		params.push(options.fromActorId);
	}

	if (options.toActorId) {
		where.push('actorB = ?');
		params.push(options.toActorId);
	}

	if (where.length > 0) {
		sql += ' WHERE ' + where.join(' AND ');
	}

	state.datasources.db.getMany(sql, params, null, function (error, relations) {
		if (error) {
			return cb(error);
		}

		for (var i = 0, len = relations.length; i < len; i++) {
			var relation = relations[i];
			relation.actorIds = [relation.actorA, relation.actorB];
			delete relation.actorA;
			delete relation.actorB;
		}

		cb(null, relations);
	});
};

/* can be achieved by calling findRelation()
exports.relationExists = function (state, type, fromActorId, toActorId, cb) {
	// Returns true if a relation for this type and these actors exists. False otherwise.

	if (!types[type]) {
		return state.error(null, 'Unknown relation type: ' + type, cb);
	}

	var options = {
		type: type
	};

	var info = types[type];

	if (info.bidirectional) {
		options.actorIds = [fromActorId, toActorId];
	} else {
		options.fromActorId = fromActorId;
		options.toActorId = toActorId;
	}

	exports.getRelations(state, options, function (error, results) {
		if (error) {
			return cb(error);
		}

		cb(null, results[0] || false);
	});
};
*/

exports.getRelation = function (state, relationId, cb) {
	var query = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation WHERE id = ?';
	var params = [relationId];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.findRelation = function (state, type, actorA, actorB, cb) {
	var typeInfo = types[type];

	if (!typeInfo) {
		return state.error(null, 'Unknown relation type: ' + type, cb);
	}

	actorA = actorA >>> 0;
	actorB = actorB >>> 0;

	// if bi-directional, lowest ID is guaranteed to be in the actorA column, highest ID on the actorB column

	if (typeInfo.bidirectional && actorA > actorB) {
		// we need to swap them

		var tmp = actorA;
		actorA = actorB;
		actorB = tmp;
	}

	var query = 'SELECT id, type, actorA, actorB, creationTime FROM sns_relation WHERE type = ? AND actorA = ? AND actorB = ?';
	var params = [type, actorA, actorB];

	state.datasources.db.getOne(query, params, false, null, cb);
};


exports.createRelation = function (state, type, actorA, actorB, cb) {
	// Create a relation between 2 actors
	// Delete any existing requests
	// Emit event to both actors
	// This function may be called externally, but should not be needed.
	// Normal flow would use requestRelation()

	var typeInfo = types[type];

	if (!typeInfo) {
		return state.error(null, 'Unknown relation type: ' + type, cb);
	}

	actorA = actorA >>> 0;
	actorB = actorB >>> 0;

	// if bi-directional, lowest ID is guaranteed to be in the actorA column, highest ID on the actorB column

	if (typeInfo.bidirectional && actorA > actorB) {
		// we need to swap them

		var tmp = actorA;
		actorA = actorB;
		actorB = tmp;
	}

	exports.findRelation(state, type, actorA, actorB, function (error, foundRelation) {
		if (error) {
			return cb(error);
		}

		if (foundRelation) {
			return state.userError('relationExists', cb);
		}

		var time = mithril.core.time;

		var relation = {
			type: type,
			creationTime: time,
			actorIds: [actorA, actorB]
		};

		exports.emit('relationCreated', [state, relation], function (error) {
			if (error) {
				return cb(error);
			}

			var sql = 'INSERT INTO sns_relation VALUES(NULL, ?, ?, ?, ?)';
			var params = [type, actorA, actorB, time];

			state.datasources.db.exec(sql, params, null, function (error, info) {
				if (error) {
					return cb(error);
				}

				relation.id = info.insertId;

				// events that describe the new relation

				state.emit(actorA, 'sns.relation.add', relation);
				state.emit(actorB, 'sns.relation.add', relation);

				cb(null, info);
			});
		});
	});
};


exports.delRelation = function (state, relationId, cb) {
	// drop the relation
	// emit event to both actors

	relationId = ~~relationId;

	exports.getRelation(state, relationId, function (error, relation) {
		if (error) {
			return cb(error);
		}

		var internal = { id: relationId, type: relation.type };

		var cfg = types[relation.type];
		if (cfg) {
			internal.actorIds = [relation.actorA, relation.actorB];
		}

		exports.emit('relationDeleted', [state, internal], function (error) {
			if (error) {
				return cb(error);
			}

			var sql = 'DELETE FROM sns_relation WHERE id = ?';
			var params = [relationId];

			state.datasources.db.exec(sql, params, null, function (error) {
				if (error) {
					return cb(error);
				}

				state.emit(relation.actorA, 'sns.relation.del', { id: relationId });
				state.emit(relation.actorB, 'sns.relation.del', { id: relationId });

				cb();
			});
		});
	});
};


exports.resetRelation = function (state, relationId, cb) {
	// TODO: drop data table here too once implemented
	// TODO: emit event to the players involved to reset anything that got reset (currently only creationTime)

	var time = mithril.core.time;

	var sql = 'UPDATE sns_relation SET creationTime = ? WHERE id = ?';
	var params = [time, relationId];

	state.datasources.db.exec(sql, params, null, function (error) {
		cb(error);
	});
};


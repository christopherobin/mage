// Social Networking Services Module.

var errors = {
	ERROR_CONST: { module: 'sns', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

var joins = {
	actorActor:  { sql: 'JOIN actor AS ? ON sns_friend.actor = ?.id' },
	friendActor: { sql: 'LEFT JOIN actor AS ? ON sns_friend.friend = ?.id' } //, requires: ['actorActor']
}

var allowedFields = {
	count:				'count (*)',
	actorId:            'actorId',
	actorName:          ['actorActor', 'name'],
	actorCreationTime:  ['actorActor', 'creationTime'],
	friendName:         ['friendActor', 'name'],
	friendCreationTime: ['friendActor', 'creationTime']
}

var emptyParams = [];


exports.getFriends = function(state, actorId, fields, filter, cb)
{
	/* GETS ACTOR'S FRIENDS
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - integer representing actor's ID
	fields - an array containing the fields required
	filter - an object to set up where clauses
	cb - callback function executed when db operation is done or on error(first param)
	*/
	
	
	var query = state.datasources.db.buildSelect(fields, allowedFields, 'sns_friend', joins) + " WHERE actor = ?" ;

	var params = [actorId];

	state.datasources.db.getMany(query, params, errors.ERROR_CONST, cb);
}

exports.areFriends = function(state, actorId, otherActorId, cb)
{
	/* TESTS IF 2 ACTORS ARE FRIENDS
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom you want to test against
	cb - callback on complete or error.
	*/
	
	var query = "SELECT count(*) AS amount FROM sns_friend WHERE actor = ? AND friend = ?"
	
	state.datasources.db.getOne(query, [actorId, otherActorId], errors.ERROR_CONST, function(err, data) {
		if(err || data.amount == 0)
		{
			cb(ERROR_CONST);
		}
		else
		{
			cb(null, true);
		}
	});
}

exports.requestFriend = function(state, actorId, otherActorId, cb)
{
	/* ACTOR A REQUESTS ACTOR B's FRIENDSHIP
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom you want to link with
	cb - callback on complete or error.
	*/
	
	var query = "INSERT INTO sns_friendrequest (actor, targetActor) VALUES ( ?, ? )";
	
	state.datasources.db.exec(query, [actorId, otherActorId], errors.ERROR_CONST, cb);
	
}

exports.getRecievedFriendRequests = function(state, actorId, cb)
{
	/* GETS FRIEND REQUESTS FOR AN ACTOR
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	cb - callback on complete or error gives back records of actors requesting actorID's friendship.
	*/
	
	var query = "SELECT actor, targetActor, actor.name FROM sns_friendrequest INNER JOIN actor ON sns_friendrequest.actor = actor.id WHERE targetActor = ?";
	
	state.datasources.db.getMany(query, actorId, errors.ERROR_CONST, cb);
}

exports.getSentFriendRequests = function(state, actorId, cb)
{
	/* GETS ACTORS TO WHOM UNACCEPTED REQUESTS HAVE BEEN SENT
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	cb - callback on complete or error gives back records of actors to who actor Id has sent an unaccepted request
	*/
	
	var query = "SELECT actor, targetActor, actor.name FROM sns_friendrequest INNER JOIN actor ON sns_friendrequest.targetActor = actor.id WHERE sns_friendrequest.actor = ?";
	
	state.datasources.db.getMany(query, [actorId], errors.ERROR_CONST, cb);
}

exports.acceptFriendRequest = function(state, actorId, otherActorId, cb)
{
	/* ACTOR A ACCEPTS ACTOR B's FRIENDSHIP
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom link up with
	cb - callback on complete or error.
	*/
	
	var sqlTestRequested = "SELECT count (*) as request FROM sns_friendrequest where actor = ? AND targetActor = ? OR actor = ? AND targetActor = ?";
	
	state.datasources.db.getOne(sqlTestRequested, [actorId, otherActorId, otherActorId, actorId], errors.ERROR_CONST, function(err, data) {
		if(err)
		{
			cb(ERROR_CONST);
		}
		else
		{
			state.datasources.db.wrapTransaction(function(){
				
				var sqlCleanup = "DELETE FROM sns_friendrequest where actor = ? AND targetActor = ? OR actor = ? AND targetActor = ?";
				state.datasources.db.exec(sqlCleanup, [actorId, otherActorId, otherActorId, actorId], errors.ERROR_CONST, null);
				
				var sqlMakeFriends = "INSERT INTO sns_friends (actor, friend) VALUES ( ? , ? )";
				state.datasources.db.exec(sqlMakeFriends, [actorId, otherActorId], errors.ERROR_CONST, null);
				
				state.datasources.db.unwrapTransaction();
				
			}, cb);
		}
	});
	
}

exports.rejectFriendRequest(state, actorId, otherActorId, cb)
{
	/* ACTOR A REJECTS ACTOR B's FRIENDSHIP REQUEST
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom link up with
	cb - callback on complete or error.
	*/
	
	var sqlCleanup = "DELETE FROM sns_friendrequest where actor = ? AND targetActor = ? OR actor = ? AND targetActor = ?";
	state.datasources.db.exec(sqlCleanup,[actorId, otherActorId, otherActorId, actorId], errors.ERROR_CONST, cb);
	
}

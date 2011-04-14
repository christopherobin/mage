// Social Networking Services Module.

var errors = {
	ERROR_CONST: { module: 'sns', code: 0000, log: { msg: 'Default error.', method: 'error' } }
};

exports.getFriends = function(state, actorId, fields, filter, cb)
{
	/* GETS ACTOR'S FRIENDS
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - integer representing actor's ID
	fields - an array containing the fields required
	filter - an object to set up where clauses
	cb - callback function executed when db operation is done or on error(first param)
	*/
}

exports.areFriends = function(state, actorId, otherActorId, cb)
{
	/* TESTS IF 2 ACTORS ARE FRIENDS
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom you want to test against
	cb - callback on complete or error.
	*/
}

exports.requestFriend = function(state, actorId, otherActorId, cb)
{
	/* ACTOR A REQUESTS ACTOR B's FRIENDSHIP
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom you want to link with
	cb - callback on complete or error.
	*/
}

exports.getRecievedFriendRequests = function(state, actorId, cb)
{
	/* GETS FRIEND REQUESTS FOR AN ACTOR
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	cb - callback on complete or error gives back records of actors requesting actorID's friendship.
	*/
}

exports.getSentFriendRequests = function(state, actorId, cb)
{
	/* GETS ACTORS TO WHOM UNACCEPTED REQUESTS HAVE BEEN SENT
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	cb - callback on complete or error gives back records of actors to who actor Id has sent an unaccepted request
	*/
}

exports.acceptFriendRequest = function(state, actorId, otherActorId, cb)
{
	/* ACTOR A ACCEPTS ACTOR B's FRIENDSHIP
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom link up with
	cb - callback on complete or error.
	*/
		
}

exports.rejectFriendRequest(state, actorId, otherActorId, cb)
{
	/* ACTOR A REJECTS ACTOR B's FRIENDSHIP REQUEST
	state - tossable object containing actors's particulars, session, dbconn etc
	actorId - this actor's ID
	otherActorId - whom link up with
	cb - callback on complete or error.
	*/
	
}

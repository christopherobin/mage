/* Instances of the State class are used to pass around a current "session" between the modules of the game platform.
 * Every component it contains is optional, although practically a datasources object should usually be available for communicating with databases, cache, etc.
 *
 * Components:
 *    session:		A player's Session object
 *    msgClient:	A connection on the message server between client and server. Can be used to send messages back to client devices.
 *    datasources:	An object that contains all connectors to datasources, such as databases and cache services.
 */


function State(session, msgClient, datasources)
{
	// constructor for State
	// arguments:
	//   session: a player's session object (optional)
	//   msgClient: a message service client object (optional)
	//   datasources: a datasources object (optional)

	this.session = session || null;			// if requests concern a player session
	this.msgClient = msgClient || null;		// if live feedback is required through the message server
	this.datasources = datasources || null;	// if datasources are required
};


State.prototype.cleanup = function()
{
	// cleanup() should always be called when a certain state is no longer needed.
	// this closes connections to databases, etc.

	if (this.datasources)
	{
		this.datasources.close();
		this.datasources = null;
	}

	if (this.msgClient)
	{
		this.msgClient.cleanup();
		this.msgClient = null;
	}
};


exports.State = State;


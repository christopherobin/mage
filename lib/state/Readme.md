# State

The state library exposes a constructor that constructs objects which form an interface between an
actor, a session and the archivist. Virtually any command that involves reading and modification of
data should be managed by a state object.

The state constructor is exposed on `mage.core.State`. When you're done using the state class,
always make sure to clean it up by calling `close()` on it. MAGE's module and command center systems
that bridge the communication between client and server use the State object for API responses and
server-sent events. We explain more about that and the concepts behind the State class in the
[walkthrough](../../docs/walkthrough/Readme.md).


## Methods

**State(actorId, session)**

The constructor. Pass an `actorId` to bind the state to the actor. That way events that are emitted
to this actor will batch up inside this state object, waiting to pulled out for delivery. If you do
not pass an actorId, emitting events to it will asynchronously be delivered via MAGE's message
stream system. If you pass a `session` object, it can be used for access level and user language
settings.

**state.setTimeout(number msec)**

If the state object is not closed within the given time, it will automatically close itself.

**state.clearTimeout()**

If a timeout has been set, this will remove it.

**state.registerSession(Object session)**

Will register the actorId and session. This is called from the constructor if a session was passed.

**boolean state.canAccess(string accessLevel)**

Returns `true` if the registered session is authorised at the given access level or beyond. Returns
`false` otherwise.

**state.setDescription(string desc)**

Tags the state with a description that is used whenever an error is logged from the state object.

**string state.getDescription()**

Returns the registered description.

**string state.language()**

Returns the language of the registered session. Returns `EN` if none is known.

**state.emit(string actorId, string path, data, string language, boolean isJson)**

Emits an event to the given actorId's client.

* actorId: The actorId to emit to.
* path: The event name (or dot separated path).
* data: Any data you want to send with this event.
* language: A language code that may be given if the data is bound to a single language only.
* isJson: If the data is a pre-serialized JSON string, pass `true`.

**state.emitToActors(actorIds, path, data, language, isJson)**

Just like `emit`, but for multiple actors at once. The actorIds argument is an array of actor ID
strings.

**state.error(string code, string logDetails, Function callback)**

Marks the state as in-error. No archivist mutations will be distributed, and the registered actor
will receive the error `code` as the first argument in the client-side callback. Pass `null` as a
code for the default "server" error code. Pass `logDetails` to write it to the logger's
error-channel. If you want to call a callback function immediately after, pass it as the third
argument.

**state.respond(data)**

This is the response that will be sent to the actor's client-side callback as the second argument.

**state.respondJson(string data)**

This is the response that will be sent to the actor's client-side callback as the second argument.
Use this variation of the respond function when your response is already JSON serialized.

**state.close(Function callback)**

Call this when you're done with the state object. All archivist mutations will now be distributed to
their datastores and events will be sent to the client. If an error has been registered, all
archivist changes, all events, and the response will be discarded.


## Usage example

```javascript
var State = mage.core.State;

var state = new State('abc');

state.archivist.get('player', { id: state.actorId }, function (error, player) {
	// from here on, we can no longer use our state object

	if (error) {
		console.error(error);
	} else {
		state.emit(state.actorId, 'myevent', { hello: 'world', youAre: player });

		console.log('Player:', player);
	}

	state.close();
});
```

# Push Tome object changes from the server to the client

In the [walkthrough](../walkthrough/Readme.md),
you learn how to create [user commands](../walkthrough/Modules.md#user-commands)
to expose some server-side methods to the client.

However in some case, you may want that the server update an object in
[Archivist](../../lib/archivist/Readme.md) and distribute the update in real-time
to your client.

It works in the same way the [events](../walkthrough/Events.md) are sent
from the server to the client.
But you must create and attach a client vault to the `Archivist` instance
attached to your `state` object.

## Example

``` javascript
function foo(actorId, topic) {
    // Create a new State object as we don't have one
    var state = new State();

	// Create a client vault to allow updates to be distributed to the client
	state.archivist.createVault('client', 'client', { state: state }, function () {

        // Get a tome object from the given topic
		state.archivist.get(topic, {
		    'actorId': actorId
		}, function (error, data) {
		    if (error) {
		        console.error(error);
		        return;
		    }

		    // Edit the tome object obtained
		    data.set('rand', Math.random());

		    // Close the state object and distribute the changes
		    state.close();

		});
	});
}
```

_Note_: `Archivist` uses the `shard` function of your topic,
defined in `lib/archivist/index.js`, to know the list of the clients
which should receive the events.

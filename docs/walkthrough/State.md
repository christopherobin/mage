# The State class

Consider that in a programming language like PHP, a single user request equals a single page
request. In Node.js it's a little bit trickier. All user requests enter the same environment in
parallel, so we need a way to track what we consider a single user request (or: transaction).

MAGE comes with a JavaScript class called `State`. This class is used to wrap a single transaction
of operations. Very often, that means a single transaction of operations that a user is trying to
execute.

For example, in a fictional RPG where player Alice wants to send a gift of 100 gold coins
to player Bob, we may go through the following transaction:

- Alice sends a request from her mobile device to our MAGE server: "send 100 gold coins to Bob".
- MAGE receives and parses the request.
- Read Alice's inventory from data store.
- Check if Alice owns at least 100 gold coins.
- Reduce Alice's gold coins by 100.
- Read Bob's inventory from data store.
- Increase Bob's gold coins by 100.
- Write changes back to data store.

## All or nothing data changes

Alice's request will carry a `state` object (an instance of the State class), which will allow this
sequence of operations to execute as a single transaction. If for any reason, we want to abort the
changes we are making to our data set (for example, halfway through we realize that Bob is not an
existing player) we can simply abort the request in error, and none of the changes will be written
to the data store. The state object manages all data mutations until successful completion of the
entire transaction. Only then do changes get written back to the data store.

For more information about the API you use to access your data store, please read the
[Archivist](../../lib/archivist) API documentation.

## Events

The state object is also responsible for emitting events for players. The event system is what
enables the MAGE server and MAGE client (in the browser) to stay synchronized about "what is true".
If Alice's request gets successfully executed, the data changes that happened will automatically
emit events to the clients in the browsers of both Alice and Bob. This will keep all data
synchronized and Bob will know in real time that his amount of gold coins just increased by 100.

If you want to send additional data, like a message saying "Alice just gave you 100 gold coins!",
you can emit your own event to Bob. On the client-side you will be able to listen for that event,
and show a notification so that Bob will know who to thank for this generous gift.

Just like having the ability to cancel all data changes, aborting the transaction will also cancel
all events that you had queued up to be emitted to players.

For more information on the State API and how events are emitted, please read the
[State](../../lib/state/Readme.md) API documentation.

## Next chapter

[Writing modules](./Modules.md)

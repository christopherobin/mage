# Events

Sometimes you will want to send real time messages to a particular player or a number of players.
The MAGE event system lets you do that.

An event is a string that names the event and a payload (usually an object).

## Sending the event

An event is emitted to a particular player by calling the right functions on the state object:

```javascript
var gift = {
	itemType: 'goldcoin',
	amount: 100,
	sender: 'Alice'
};

state.emit(playerId, 'gift.received', gift);
```

### The origin of the state object

When you implement a user command through a module, you should always have access to the state
object that represents the user's request. If however, you need to create a state object yourself,
you can do this as follows.

```javascript
var mage = require('mage');
var State = mage.core.State;
var state = new State();

state.emit(playerId, 'gift.received', gift);

state.close();
```

For more information, please read the [State API documentation](../../lib/state/Readme.md).

### Sending a broadcast event

You can send an event to all the users who are currently connected to the application.
You just have to use the same method, but with null as first parameter instead of the actorId.

```javascript
var gift = {
	itemType: 'goldcoin',
	amount: 100,
	sender: 'Alice'
};

state.emit(null, 'gift.received', gift);
```

## Receiving the event

On the browser, this event can be picked up by calling:

```javascript
mage.msgServer.on('gift.received', function (path, gift) {
	// path is "gift.received" or "gift.received.something..."

	alert('You received ' + gift.amount + ' ' + gift.itemType + ' from ' + gift.sender);
});
```

By leveraging the dot-separation, you can also listen for a shorter part of the event name path:

```javascript
mage.msgServer.on('gift', function (path, gift) {
	// path is "gift" or "gift.something..."

	switch (path) {
	case 'gift.received':
		alert('You received ' + gift.amount + ' ' + gift.itemType + ' from ' + gift.sender);
		break;
	default:
		console.error('Unknown gift-related event:', path, gift);
	}
});
```

## Did you know?

The Archivist data store API uses the event system internally to communicate changes in data from
the server back to the browser. That way you can always count on your players having the latest
data readily available!

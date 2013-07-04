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

# Process Messenger

This module helps you to manage communication between your master process and your workers.

## API

### Messenger(string namespace)

Instantiate a new messenger.
It will use the given `namespace` to prefix all the messages internally.

### messenger.broadcast(string message, object data)

This method allows you to send a message to all the workers of your cluster.
It can be used only from the master process.

### messenger.send(string message, object data)

This method allows you to send a message from one worker to the master process.
It can be used only from a worker.

## Events

Your will receive events with the name of the messages sent.

```javascript
// On the master
var Messenger = require('processMessenger');
var messenger = new Messenger('namespace');

messenger.on('event', function (data) {
    messenger.broadcast('event', data);
});
```

```javascript
// On the workers
var Messenger = require('processMessenger');
var messenger = new Messenger('namespace');

messenger.on('event', function (data) {
    console.log('event received:', data);
});
messenger.send('event', {});
```

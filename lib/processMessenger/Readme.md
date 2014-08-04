# Process Messenger

This module helps you to manage communication between your master process and your workers.

## Methods

### broadcast(string message, object data)

This method allows you to send a message to all the workers of your cluster.
It can be used only from the master process.

### send(string message, object data)

This method allows you to send a message from one worker to the master process.
It can be used only from a worker.

## Events

Your will receive events with the name of the message sent.

```javascript
// On the master
messenger.on('namespace.event', function (data) {
    messenger.broadcast('namespace.event', data);
});
```

```javascript
// On the workers
messenger.on('namespace.event', function (data) {
    console.log('namespace.event received:', data);
});
messenger.send('namespace.event', {});
```

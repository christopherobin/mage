# The Savvy server library

## API

Savvy provides a server for various management interfaces. The server has a
simple API for registering regular HTTP routes and websocket routes:

* `getBaseUrl()`
* `addRoute(routePath, routeFunction)`
* `addWebSocketRoute(routePath, routeFunction)`

The base URL is configuration driven, and can be resolved with the `getBaseUrl`
function. All routes sit on subpaths immediately on top of the base URL. This
means that the `routePath` parameter taken by the other two (route registration)
methods should contain exactly one `/`, which should be leading. This namespaces
your request handlers. If you wish to operate with subpaths, this can be managed
by a registered `routeFunction`. The sampler library does this to allow subpath
tunnelling down into data.

`addRoute` takes a route path and a handler function `routeFunction` which takes
the usual `request` and `response` objects as parameters. For example:

```javascript
mage.core.savvy.addRoute('/sampler', function (req, res) {
    // Sampler uses subroutes, which may be obtained from req.
});
```

`addWebSocketRoute` takes a route path and a handler function `routeFunction`,
which takes a WebSocket client connection object as its only parameter.
For example, from the websocket logger:

```javascript
mage.core.savvy.addWebSocketRoute('/logger', function (conn) {
	conn.once('close', function () {
		// cleanup
	});

	conn.on('message', function (message) {
		// logic
	});
});
```

Refer to the [ws documentation](https://github.com/einaros/ws) for more
information on the connection objects.

The same route may be registered for a WebSocket handler **and** an HTTP
handler. The right handler will be selected based on the incoming request.

## Configuration

Savvy configuation is small. For example for local development the following
is a reasonable template (at the top level of your configuration):

```yaml
savvy:
    bind:
        host: 0.0.0.0
        port: 4321
    expose: http://mydomain:4321
```

If you want to use a unix socket, then replace the `host` and `port` keys:

```yaml
savvy:
    bind:
        file: ./savvy.sock
    expose: http://mydomain/savvy # unix socket bindings depend on proxies like Nginx
```

Be warned though, until recently websockets were not supported with Nginx.

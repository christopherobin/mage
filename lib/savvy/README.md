# The Savvy server library

## API

Savvy provides a server for various management interfaces. The server has a
simple API for registering regular HTTP routes and websocket routes:

* `getBaseUrl()`
* `addRoute(routePath, routeFunction)`
* `addWebSocketRoute(routePath)`

The base URL is configuration driven, and can be resolved with the `getBaseUrl`
function. All routes sit on subpaths immediately on top of the base URL. This
means that the `routePath` parameter taken by the other two (route registration)
methods should contain exactly one `/`, which should be leading. This namespaces
your request handlers. If you wish to operate with subpaths, this can be managed
by a registered `routeFunction`. The sampler library does this to allow subpath
tunnelling down into data.

`addRoute` takes a route path and appends a simple HTTP handler function
`routeFunction`. This handler function takes the usual `request` and `response`
objects as parameters. For example:

```javascript
mage.core.savvy.addRoute('/sampler', function (req, res) {
    // Sampler uses subroutes, which may be obtained from req.
});
```

`addWebSocketRoute` creates a websocket server route for you, and gives it back
as the return value of the function. For example, from the websocket logger:

```javascript
var server = mage.core.savvy.addWebSocketRoute('/logger');

server.on('connection', function (conn) {
    // Do stuff with the connection object.
});
```

Refer to the [ws documentation](https://github.com/einaros/ws) for the APIs of
the server and connection objects.

## Configuration

Savvy configuation is small. For example for local development the following
is a reasonable template (at the top level of your configuration):

```yaml
savvy:
    bind:
        host: 0.0.0.0
        port: 4321
    expose: http://dev.wizcorp.jp:4321
```

If you want to use a socket, then replace the `host` and `port` keys:

```yaml
savvy:
    bind:
        file: ./savvy.sock
    expose: http://testapp.me.node.wizcorp.jp/savvy # Depends on nginx!
```

Be warned though, until recently websockets were not supported with nginx.

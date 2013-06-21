# The Savvy server library.

Savvy provides a server for various management interfaces. The server has a
simple API for registering regular HTTP routes and websocket routes:

* `getBaseUrl()`
* `addRoute(routePath, routeFunction)`
* `addWebsocketRoute(routePath)`

The base URL is configuration driven, and can be resolved with the `getBaseUrl`
function. All routes sit on subpaths immediately on top of the base URL. This
means that the `routePath` parameter taken by the other two (route registration)
methods should contain exactly one `/`, which should be leading. This namespaces
your request handlers. If you which to operate with subpaths, this can be
managed by a registered `routeFunction`. The sampler library does this to allow
subpath tunnelling into data.

`addRoute` takes a route path and appends a simple HTTP handler function
`routeFunction`. This function takes the usual `request` and `response` objects
as parameters. For example:

```javascript
mage.core.savvy.addRoute('/sampler', function (req, res) {
    // Sampler uses subroutes, which may be obtained from req.
});
```

`addWebsocketRoute` creates a websocket server route for you, and gives it back
as the return value of the function. For example, from the websocket logger:

```javascript
var server = mage.core.savvy.addWebSocketRoute('/logger');

server.on('connection', function (conn) {
    // Do stuff with the connection object.
});
```

Refer to the [ws documentation](https://github.com/einaros/ws) for the api of
the server and connection objects.
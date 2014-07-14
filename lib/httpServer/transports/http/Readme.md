# HTTP Server

## Registering routes

### httpServer.addRoute(pathMatch, handlerFunction, type)

This registers a route (a string or a regular expression) on the HTTP server. Incoming requests will
be expected to be handled by the handler function you pass. Based on the type you specify, your
handler function will receive different arguments.

#### "simple": handler(req, res, path, query, urlInfo)

* req: the IncomingMessage object.
* res: the ServerResponse object.
* path: the path part of the URL.
* query: the parsed query string.
* urlInfo: all information that came out of `url.parse()`.

#### "callback": handler(req, path, query, callback)

* req: the IncomingMessage object.
* path: the path part of the URL.
* query: the parsed query string.
* callback: call this when you've constructed your HTTP response.

The callback accepts the following arguments in order:

* httpCode: the HTTP status code you want to return.
* out: a string or buffer that you want to send to the client.
* headers: an object with headers.

#### "websocket": handler(client, urlInfo)

* client: a WebSocket client connection object. See the [`ws` documentation](https://npmjs.org/package/ws).
* urlInfo: all information that came out of `url.parse()`.

#### "proxy": endpoint handler(req, urlInfo)

* req: the IncomingMessage object.
* urlInfo: all information that came out of `url.parse()`.

Your handler function *must* return an endpoint object to connect to. For syntax, please read the
[`net.connect()`](http://nodejs.org/docs/latest/api/net.html#net_net_connect_options_connectionlistener)
documentation.

### httpServer.delRoute(pathMatch)

Removes the handler function registered on the given route.


## Simple file serving

### httpServer.serveFile(route, filePath, [errorHandler])

Registers a route to lead directly to a file on disk. If you want to receive errors, rather than
have the HTTP server log them, you may pass an error handler function.


## check.txt

By default, the HTTP server will serve a file "check.txt" from the root folder of your project, if
it exists. This can be useful for services such as load-balancers to poll for the availability of
your application.


## Custom Favicon

### httpServer.setFavicon(buffer, [mimetype])

Registers a route "/favicon.ico" and serves the given buffer as content. The mime type defaults to
`image/x-icon` and may be overridden.


## Cross-Origin Resource Sharing (CORS)

If you want your application to span multiple domains, you need to enable CORS. For information on
what CORS is, please consult the following websites.

- [HTML5 Rocks tutorial](http://www.html5rocks.com/en/tutorials/cors/)
- [Mozilla](https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS)
- [w3c spec](http://www.w3.org/TR/cors/)

### Performance

Keep in mind that using CORS will often cause so-called "preflight" requests. A preflight request
is an HTTP `OPTIONS` request to the server to confirm if a request is allowed to be made in a manner
that is considered safe for the user. Only after this confirmation will a real `GET` or `POST`
request be made. All this happens invisible to the end user and developer, but there is a
performance penalty that you pay, caused by this extra round trip to the server.

### Using authentication and CORS

If you use `Basic` or any other HTTP authentication mechanism, you cannot configure CORS to allow
any origin using the `*` wildcard symbol. In that case, you must specify exactly which origin is
allowed to access your server.

### Configuration

In your configuration, you can enable CORS like this:

```yaml
server:
    clientHost:
        cors:
            methods: "GET, POST, OPTIONS"
            origin: "http://mage-app.wizcorp.jp"
            credentials: true
```

* `methods` (optional) lists which HTTP request methods are acceptable.
* `origin` (optional) sets the required origin, may be (and defaults to) `"*"`
* `credentials` (optional) must be set to `true` if you want cookies and HTTP authentication to be
  usable at all. You can then no longer use the wildcard origin.

### CORS in IE9

The XMLHttpRequest object exist on IE8+ but sadly [CORS is not supported on IE8 and IE9](http://caniuse.com/#search=cors).
So the idea is to use the XDomainRequest object for those old version of IE but here is the catch:
XDomainRequest doesn't hold a status code.

#### How to deal with IE9 without status code then?

You may already have it in place in your app. If not, here what you could do.

When communicating with the server, the request will time out and generate a 'network' error.
You can listen to it from the msgServer `msgServer.on('io.error.network', doSomething);`.
The suggestion here is to retry (`msgServer.resend();`) on a network error and to reload the app
after n retries. If the app is in maintenance it would probably show the maintenance page.

##### What does it change for other browsers?

Absolutely nothing. And you can still apply the retry logic on network errors, it's not a bad idea.

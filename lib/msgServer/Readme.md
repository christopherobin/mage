# Message Server

The message server is in charge of event propagation through the system, and the hosting of the
HTTP server.

## HTTP Server

The HTTP Server, inside MAGE also known as the client host, serves pages and user commands.

### Cross-Origin Resource Sharing (CORS)

If you want your application to span multiple domains, you need to enable CORS. For information on
what CORS is, please consult the following websites.

- [HTML5 Rocks tutorial](http://www.html5rocks.com/en/tutorials/cors/)
- [Mozilla](https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS)
- [w3c spec](http://www.w3.org/TR/cors/)

#### Performance

Keep in mind that using CORS will often cause so-called "preflight" requests. A preflight request
is an HTTP `OPTIONS` request to the server to confirm if a request is allowed to be made in a manner
that is considered safe for the user. Only after this confirmation will a real `GET` or `POST`
request be made. All this happens invisible to the end user and developer, but there is a
performance penalty that you pay, caused by this extra round trip to the server.

#### Using authentication and CORS

If you use `Basic` or any other HTTP authentication mechanism, you cannot configure CORS to allow
any origin using the `*` wildcard symbol. In that case, you must specify exactly which origin is
allowed to access your server.

#### Configuration

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

#### CORS in IE9

The XMLHttpRequest object exist on IE8+ but sadly [CORS is not supported on IE8 and IE9](http://caniuse.com/#search=cors).
So the idea is to use the XDomainRequest object for those old version of IE but here is the catch:
XDomainRequest doesn't hold a status code.

##### How to deal with IE9 without status code then?

You may already have it in place in your app, if not here what you could do.

When communicating with the server, the request will time out and generate a 'network' error.
You can listen to it from the msgServer `msgServer.on('io.error.network', doSomething);`.
The suggestion here is to retry (`msgServer.resend();`) on a network error and to reload the app after n retries.
If the app is in maintenance it would probably show the maintenance page.

##### What does it change for other browsers?
Absolutely nothing.
And you can still apply the retry logic on network errors, it's not a bad idea.
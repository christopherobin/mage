# Loader

The loader is a library for browsers to download packages of CSS and JavaScript from the MAGE
server.


## Instantiation

To use the loader, please add it to the component.json file of your application. If you are doing
this for the first time, please take a bit of time to read
[Creating a Web App](../../docs/walkthrough/WebApp.md#creating-a-mobile-friendly-componentio-single-page-app)
before you start.

The loader component is a "local" dependency, that is located in "mage/lib", so this is the path
you will need to add to component.json. Incidentally, the path you use to `require('mage');` is the
same.

To import the loader, simply require it and configure it with the `mageConfig` that the builder
exposes for you on the `window` object.

```javascript
var loader = require('loader');
loader.configure(window.mageConfig);
```


## API

### Methods

#### configure(Object configuration)

Configures the loader. MAGE will provide the configuration during the build process and exposes it
as `window.mageConfig`. This configuration includes all that is needed to communicate with the
server and download its packages.

#### setLanguage(string language)

Informs the loader to download packages that were built for a particular language. It may be
called at any time (for example, after having loaded some packages). This can be useful when using
a platform that provides language as part of a user's profile after authentication. It's not
absolutely required to call this function. The fallback language is `"en"` (English).

#### setDensity(number density)

Use this to inform the loader of the pixel density of the device. This is required when offering
assets tailored to several specific pixel densities (in Apple's terminology, retina and non-retina).
It's not absolutely required to call this function. The fallback density is `1`.

#### loadPage(string name)

Downloads the CSS and JavaScript package from the server. The loader maintains a package cache in
the browser's `localStorage` object (if available) that is based on a hash of the content that is
calculated by the server. When downloading a page, the loader will send along the known hash and if
it still matches with the hash on the server, the server will inform the loader to simply use the
cached version instead of downloading it.

When the download has finished, the following steps are automatically
executed:

1. If the cached hash matches, load the package from localStorage, else update the cache with the
   now downloaded package.
2. Parse the package.
3. Emit the "parsed" event.
4. Execute the JavaScript of the package (with component.io, that only registers all modules).
5. Emit the "loaded" event.

#### loadPages(string[] names)

Will call loadPage, one by one, for each package name you have provided.

#### HTMLDivElement renderPage(string name)

Once a package has finished loading, you may add its HTML contents to the document. The loader will
put those contents inside a `<div>` element that it creates, which starts out hidden by a
`display: none;` style. When that is done, it returns the `<div>` container.

#### HTMLDivElement displayPage(string name)

Will call `renderPage(name)` if you haven't done that yourself, and then make the package visible by
removing its `display: none;` style. If another package is currently visible, it will make that one
invisible at the same time. The loader will emit a "<name>.close" event for the package it hides,
and a "<name>.display" event for the package it displays. When everything is done, it returns the
`<div>` container of the package that is now displayed.

#### HTMLDivElement getDisplayedPage()

Returns the package that is currently visible, or `null` if no package has been made visible yet.


### Events

The loader emits events throughout its operations. It also does this to inform you of the state of
the network and server while packages are being downloaded. You can listen for events by calling

```javascript
loader.on('eventname', function (arg1, arg2, etc) {
});
```

#### online: (string pageName)

When the loader detects we are able to download a package, and the state was not "online" before,
it emits this event. Please note that the loader starts out assuming we are online, so when the
connection is stable the whole time, this event should never be emitted.

#### offline: (string pageName)

When the loader detects we are unable to download a package, due to the fact that we cannot reach
the server, it emits this event. It will automatically keep retrying the download. Once it succeeds,
the "online" event will be emitted.

#### maintenance: (string content, string mimeType)

This is emitted when a server responds with a 503 code, indicating that the server is undergoing
maintenance. Like when offline, the loader will automatically keep retrying to download the package.
The `content` argument contains the response body to the HTTP request. Servers can for example
provide a message to indicate when the service should resume. The `mimeType` argument indicates what
type the content is. This could for example be `text/html` or `text/plain`. You can use this to
decide how to render the message.

#### parsed: (string pageName, Object page)

When a download has completed, or when a package has been loaded from cache, it is immediately
parsed into its embedded parts (HTML, CSS, JavaScript). Once that parsing has completed, the result
of that is emitted through this event. The given page object will contain the following properties.
The values below are examples of what they could look like.

```json
{
  "html": "<html>...</html>",
  "js": "function foo() { /* etc */ }",
  "css": "body { margin: 0; } /* etc */"
}
```

If you need to do any post processing on these values, while not particularly encouraged, you can do
that during this event.

#### <pageName>.loaded: ()

Emitted once a package has been parsed and its JavaScript has been executed. Please note that in the
case of a component.io package that does not mean that the code of its modules has been executed.
It simply means that the modules are now registered and `require` can be used to run them.

#### <pageName>.display: (HTMLDivElement container)

Emitted when a package is displayed. The `<div>` element contains the HTML for this package and may
be used to add more HTML content to it.

#### <pageName>.close: ()

Emitted when a package is being hidden. Only one package is displayed at any time, so this event
is emitted every time a new page is displayed (except the first time, when there is nothing to hide).

#### error: (Error error)

When any error occurs, it is emitted through this event.

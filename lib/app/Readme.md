# App

Here we creare instances of applications (entry points) served by the mage
msgServer.

## Web App

This is the currently the only app type we have in mage. As such all new apps
will be a new instance of this. You can register pages on a WebApp which
essentially become routes to be served.

### Pages

These are essentially routes on a Web App which will serve as client entry
points. Pages can be added using a few different APIs:

setIndexPage(path, options)
addIndexPage(name, path, options, assetOptions)
addPage(name, path, options)

### Components

TBD

registerComponent(name, path, requiredBy, options)

#### Request Hooks

If you want to execute checks before processing a request this is what you would
use. Basically all requests would be fed to these hooks for checking, and if you
return a response object, it will be returned to the client with no further
processing.

This would essentially be used for firewalling and checking device compatibility.

Here is an example compatibility checker:
```javascript
	var useragent = require('useragent');
	var game = mage.core.app.get('game');

	game.registerRequestHook(function (req, path, params, requestType) {
		// By filtering by requestType, we improve performance of all commands
		if (requestType === 'route') {
			if (!useragent.is(req.headers['user-agent']).webkit) {
				return { code: 303, headers: { 'Location': 'http://some.url.com/' }, output: null};
			}
		}
	});
```

#### Configuration

In your configuration, you can enable an app using something like this:

```yaml
apps:
	# Replace appName with the name of the app you wish to enable
    appName:
        responseCache: 10
        access: user
        delivery:
            clientConfigs:
                languages: [ en ]
                densities: [1]
                screens: [[1, 1]]
            useManifest: false
            compress: true
```

* `appName` (mandatory) This is the name of the app you wish to enable.
* `responseCache` (optional) Number of seconds usercommands should be cached for.
* `access` (optional) This will determine which usercommands are exposed on the
   client. Only commands of the same access level or lower will be exposed.
* `languages` (optional) Array of languages this app supports.
* `densities` (optional) List of screen densities to setup an asset map for
  (1 being the lowest). The asset map with the closest density lower than that
  of the device will be served.
* `screens` (optional) List of screen sizes to setup an asset map for
* `useManifest` (optional) Whether or not the client html5 manifest system
  should be used for asset storage management. Warning that this feature can be
  the cause of multiple update issues.
* `compress` (optional) Whether or not responses should be compressed.

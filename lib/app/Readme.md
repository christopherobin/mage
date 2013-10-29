# App

Here we create instances of applications (entry points) served by the mage msgServer.

## Web App

This is currently the only app type we have in mage. As such all new apps will be a new instance of
this. You can register pages on a WebApp which essentially become routes to be served.

### Pages

Pages are essentially routes on a WebApp which will serve as client entry points. Pages can be added
using a few different APIs:

* `setIndexPage(path, options)` This function will set the root 'loader' page for the application
under 'http://your.game.com/app/appName/'

* `addIndexPage(name, path, options, assetOptions)` This will add a loader page for a WebApp under a
given route. Essentially index pages are entry pages which have html and body tags wrapped around
the content.

* `addPage(name, path, options)` This will add a view page for a WebApp. These pages do not contain
html and body tags wrapped around the content. These pages also cannot be given a route. Mage will
automatically place these pages under 'http://your.game.com/app/appName/pageName'.


### Components

TBD

* `registerComponent(name, path, requiredBy, options)` 

#### Request Hooks

If you want to execute checks before processing a request this is what you would use. Basically all
requests would be fed to these hooks for checking, and if you return a response object, it will be
returned to the client with no further processing.

This would essentially be used for firewalling and checking device compatibility.

Here is an example compatibility checker:
```javascript
	var useragent = require('useragent');
	var game = mage.core.app.get('game');

	game.registerRequestHook(function (req, path, params, requestType) {
		// By filtering by requestType, we improve performance of all commands
		if (requestType === 'webapp') {
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
        responseCache: 300
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
* `access` (optional) This will determine which usercommands are exposed on the client. Only
  commands of the same access level or lower will be exposed.
* `languages` (optional) Array of languages this app supports.
* `densities` (optional) List of screen densities to setup an asset map for (1 being the lowest).
  The asset map with the closest density lower than that of the device will be served.
* `screens` (optional) List of screen sizes to setup an asset map for
* `useManifest` (optional) Whether or not the client html5 manifest system should be used for asset
  storage management. Warning that this feature can be the cause of multiple update issues. Check
  `Application cache` section below.
* `compress` (optional) Whether or not responses should be compressed.


#### "Application cache" or "Offline web applications"

This is the browser feature we use when setting the `useManifest` configuration above. More
infomation can be found on these at the following links:

* [Mozilla application cache](https://developer.mozilla.org/en/docs/HTML/Using_the_application_cache)
* [W3 offline web applications](http://www.w3.org/TR/2011/WD-html5-20110525/offline.html)
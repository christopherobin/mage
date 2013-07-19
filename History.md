# Release history

## vNext

### Dashboard

#### A new dashboard: dev

The two dashboards "cms" and "support" have been augmented by a third: "dev". This allows us to
strip down the former two to their essentials, and move all developer-only tools into the dev
dashboard. For now, we have organized the pages as follows:

Page             | dev | cms | support
-----------------|:---:|:---:|:------:
Home             | ✔   | ✔   | ✔
Documentation    | ✔   | ✔   | ✔
Configuration    | ✔   |     |
Style guide      | ✔   |     |
Archivist        | ✔   |     |
Assets           | ✔   |     |
Logger           | ✔   | ✔   | ✔
Time             | ✔   |     |

#### Changed dashboard configuration

The dashboard page configuration has been modernized (this is a **breaking change**). Configuration
for a dashboard page used to be a file inside the page's folder called `page.json`. This has now
been moved into the module's own configuration file `modules/mymodule/config.yaml` (or
`config.json`, you choose).

Example from the archivist module:

```yaml
dashboard:
    pages:
        archivist:
            name: Archivist
            listed: true
            apps:
                - dev
```

The variables in this example are:

- `archivist`: the folder name where the component can be found.
- `Archivist`: the human readable name for display in the sidebar.
- `true`: a boolean that exposes the page in the sidebar.
- `dev`, `cms` and `support`: the list of apps that should expose this page.

For more examples, please have a look at the Configuration Inspector in the `dev` dashboard app.

This also means that you can now override the MAGE built-in dashboard pages' configuration. By
overriding the archivist dashboard's `apps` entry for example, you can change in which dashboard
apps the Archivist page is visible. When overriding, keep in mind that this configuration example is
a module default, which means that the actual full path is like in the following example:

```yaml
module:
    archivist:
        dashboard:
            pages:
                archivist:
                    name: "Bob's Data Emporium"
```

### Bugfixes

* Dashboard: table cell alignment in markdown content was not being applied.


## v0.15.2 - Bread Cat

### Archivist

A lot of refactoring has happened in Archivist, cleaning up large parts of the startup phase of the
codebase and the client change distribution and cache synchronisity. In the process, a few bugs were
found and fixed (see below). The opportunity was also taken to improve performance here and there.

Documentation on the vaults has been augmented with API tables for how topics are read from and
written to the underlying data store. The term "Vault Handler" has once and for all been replaced by
"Topic API".

### Component

Component build internals have been refactored, removing the need for a `window.mageConfig.pageName`
variable on the browser.

### Bugfixes

* Server cache has been fixed. Has been broken since at least March 2013.
* Doing list operations on the memory vault would return with as many callbacks as there were values (0 or more).
* The archivist dashboard would throw (innocent) JavaScript errors if a get request failed.
* If `distribute()` was called on the client without pending changes, it would stay in `distributing` state.
* When data was deleted or expiration times were modified by the client, the cache would sometimes not update itself accordingly.
* If no environment config could be found, the config module would die.
* MAGE could not be properly run in a REPL environment.


## v0.15.1 - まる君

### Config

#### Configuration Inspector dashboard

We've added a Configuration Inspector dashboard page, which will show you exactly what your full
configuration looks like, and how it came to be that way. It shows exactly which configuration
entries come from which config files. This should help you debug tricky configuration issues and
hopefully gives you clearer insight into how MAGE operates.

#### YAML parsing

When YAML parsing fails, we now display where and in which file that happened.

### Archivist dashboard

We now render the MediaType above the DocEditor, so you can tell if something is a Tome or not.

### Bugfixes

* Since v0.15.0 Savvy no longer exposed its URL correctly, breaking the dashboard logger.
* The dashboard sidebar can now scroll vertically when there are more menu items than fit on the screen.
* Archivist dashboard: Fixed empty object rendering in Tome and JSON rendering.
* Archivist dashboard: Fixed the not-clearing of the list results and document on topic-change.


## v0.15.0 - DepriCat

### Removal of deprecated API

* `mage.addModule` has been removed (deprecated since v0.12.0).
* `mage.useModule` has been removed (deprecated since v0.12.0).
* Feeding configuration into `mage.setup` is no longer supported (deprecated since v0.13.0).
* `state.userError` has been removed (deprecated since v0.10.0).

### Configuration

node-config is dead, long live config! We rolled our own because we were tired of the baggage that
came with node-config (including that annoying runtime file). This also allowed us to store some
metadata about configuration (like where each part originated from). For the most part it has the
same API as before, but there is one big breaking change, so please take care. Addressing
configuration like

```javascript
mage.core.config.something.somethingElse
```

will no longer work. The use of the `get(...)` method is now mandatory. This is due to the
underlying storage structure of the configuration. Otherwise, changes are additions to the API. Take
a look at the [updated config readme](./lib/config/Readme.md).

### Redis vault

We've added a Redis vault to Archivist! For more information visit the official
[Redis website](http://redis.io), or read the
[Redis vault documentation](./lib/archivist/vaults/redis/Readme.md).

### Bugfixes

* We have fixed a number of issues with archivist client that broke diffing in the dashboard.


## v0.14.1 - Samurai Pizza Cat

### Component

The component build-directive now also works for CSS. In the future, we will attempt to upgrade the
mage-page builder to require all styles to go through component. It's therefore advisable to start
referring to the CSS files in your components.

### Documentation

A lot of documentation has been added in the "Walkthrough: making a MAGE game" section.

In the dashboard, the navigation element has been replaced with a solution that somewhat resembles
the OS X Finder. It establishes much clearer context than what we had before.

### Bugfixes

* Errors being thrown by listeners of the dashboard router were logging the wrong stack.
* The Component ignore list was not being applied correctly, potentially causing builds to contain duplicate code.


## v0.14.0 - Monorail Cat

### Development mode

You can now enable "development mode" in your configuration, and are encouraged to do so in your
development environments. Using dev mode will enable certain features now (and more and more in the
future) that only make sense while developing, and would be dangerous or useless in production.

You enable development mode by adding the following configuration:

```json
{
	"developmentMode": true
}
```

If you want to know if an application is running in development mode, you can call the following,
both on the server side and on the client side:

```javascript
mage.isDevelopmentMode();
```

### Dashboard

MAGE now comes with a set of dashboards (tools). Currently, the only way to log in is anonymously.
User management will appear in an upcoming release. That means that for now, tools should not be
used on production environments. Logging in anonymously requires development mode to be enabled.

There are two dashboard environments available to be exposed: "cms" and "support". CMS is aimed at
content management (pre-production), and support is aimed at customer support channels. You can
divide your dashboard pages into either of these two categories, or both.

You can expose these dashboard apps by adding the following configuration:

```json
{
	"apps": {
		"cms": {
			"responseCache": 10,
			"access": "admin"
		},
		"support": {
			"responseCache": 10,
			"access": "admin"
		}
	}
}
```

The reason for "admin" level access is that we want to expose those administration-level user
commands to these apps. Despite that, development mode still enables anonymous login. The access
level given to these anonymous sessions *will* be "admin", allowing you to run these user commands.

The reason for a short responseCache is that generally (at least for now), these dashboards will be
accessed on stable network connections, so we don't have to dedicate a lot of memory on mitigating
dodgy networks.

The dashboard currently provides the following:

* Archivist (read/write access to all your vault values)
* Asset management
* Documentation
* Logger
* Time
* Dashboard style guide

There is a home screen that is currently quite empty, but in the future you can expect widgets here!

### Documentation

A start has been made to radically improve the documentation in MAGE. This is an ongoing effort, so
you can definitely expect many incremental improvements in the near future.

### MAGE installer

New MAGE projects can now be started through a new installer. You can have a project up and running
and accessible through your browser well within a minute! Read the documentation for more
information on [how to install](./docs/Install.md).

### Dependency updates

* async 0.2.7 -> 0.2.9
* zmq 2.3.0 -> 2.4.0
* colors custom -> colours 0.6.0
* tomes 0.0.14 -> 0.0.15
* panopticon 0.1.1 -> 0.2.0
* js-yaml 2.0.4 -> 2.1.0
* config 0.4.23 -> 0.4.27
* component-builder custom -> 0.8.3
* memcached 0.2.2 -> 0.2.3
* ws 0.4.25 -> 0.4.27
* mocha 1.9.x -> 1.12.0
* jshint 1.1.x -> 2.1.3

### Legacy cleanup

* Removed actor, player, gm and gree modules.
* Renamed tool to dashboard.

### Deprecation

The pauser module has been deprecated, since it really never had anything to do with MAGE. It did
fulfill a useful purpose on the frontend, so it has been replaced by the
[Locks component](https://github.com/Wizcorp/locks), which you are now very much encouraged to use
instead.

### User commands

User commands can now receive arrays of files. Simply make a JavaScript array with DOM File or Blob
objects and use it as an argument.

### Savvy

Savvy superceeds the sampler server. It provides a server on the master to host such things as the
sampler and the logger. This is ideal for feeding data to the management webtools. Savvy provides
some APIs for registering routes, both on HTTP and websocket. See the
[readme](./lib/savvy/Readme.md) for more information.

### Assets

Asset digests are now cached, speeding up indexing by almost 3x on previously indexed asset maps.

### Archivist

Archivist client now actively expires values when their TTL runs out.

**Breaking change:**

The File Vault now uses the hash (#) to separate topic and index, instead of question mark (?).
Also, asterisk (*) is now escaped. The reason for these changes is to achieve wider file system
compatibility.

Use this one-liner in any folder with file vault content to rename your files automatically:

```bash
IFS=$'\n'; for file in $(ls ./); do mv "${file}" "$(echo $file | sed 's/?/#/')"; done
```


### Logger

Terminal and File loggers now prefix the PID with "m-" or "w-" to indicate if the process is master
or worker.

### Component

You can now add lookup paths on the component builder by calling:

```javascript
mage.core.app.builders.get('component').addLookupPath('my/component/folder');
```

Also, when you have a module that has no client-side implementation but does expose user commands,
you no longer have to create a component.json file with an empty client.js file. Simply leave them
out, and MAGE will construct an empty module with user commands on it.

### Bug fixes

* Access level errors when executing user commands were not verbose enough.
* Asset indexing could become so parallelized that EMFILE errors would be thrown (too many open files).
* Asset module's client side `applyAssetMapToStylesheet` method was broken on Firefox.
* Archivist beforeDistribute hooks were unable to report an error.
* Archivist client could throw an exception when optional values were queried for. (Thanks Max!)
* WebSocket logger was not working reliably and was leaving socket files behind.
* Even when configuration for other logger writers was provided, the terminal was always being logged to.
* User command execution time was showing seconds with a "msec" unit. Now these are real milliseconds.
* The loader would prevent the right density from being set.
* Querying for a componentized page without clientConfig would crash the HTTP request handler.
* Fixed mdns hostname assumption. (Thanks Almir!)
* Fixed a few bugs in msgServer that could cause weird heartbeat timings. (Thanks Almir!)


## v0.13.0

### Asset serving in MAGE

That's right, MAGE can now serve your assets! This is not battle tested and we do not promote the
usage of this feature in production, but it makes your development cycle a bit easier.

To enable this, simply leave out the base URL configuration from your config file at:

```json
{
	"module": {
		"assets": {
			"baseUrl": {
				"webview": "http://this.one/gets/to/stay"
			}
		}
	}
}
```

MAGE will automatically fall back to built-in asset hosting for asset contexts that do not have a
configured base URL.


### User command system overhaul

#### Access levels

There is a new, simple rights management system in MAGE based on *access levels*. There are exactly
three access levels in place:

1. anonymous
2. user
3. admin

From now on, all user commands are internally marked with an access level. That means that only
users who are running a session that gives them the right access level will be able to execute it.
Marking a user command with access level "anonymous" means that anyone may execute it. At the
other extreme, marking a user command as "admin" means that only administrators may execute it.

You can mark a user command with an access level, inside the user command code by writing:

```javascript
exports.access = 'user';
```

Failing to do so, will mark the user command as "admin", which means nobody but administrators will
be able to execute it (secure by default).

When people do not yet have a session, they are considered "anonymous" and can only execute user
commands marked as *access level "anonymous"*. Some typical examples here are: time-sync, login.
At the time of session registration, an access level should be set by passing the right meta object
into the session API. For example:

```javascript
// access may be: "anonymous", "user" or "admin"

mage.session.register(state, actorId, language, { access: 'user' }, function (error, session) {
});
```

Make sure your game executes that logic correctly.


#### Code removal

Because of the new access level system, you no longer have to configure your command centers. That
means you get to **remove** a lot of code, namely:

1. all calls like `myApp = new mage.core.app.web.WebApp('gamename', { languages: ['en'], densities: [1], screens: [[1, 1]] });`
2. all calls like `myApp.commandCenter.expose(...);`

The WebApp instantiation is now done automatically, and is driven by your configuration (note
especially `access`, `disabled` and `clientConfigs`, which are new):

```json
{
	"apps": {
		"gamename": {
			"responseCache": 1200,
			"access": "user",
			"disabled": false,
			"delivery": {
				"clientConfigs": {
					"languages": ["en"],
					"densities": [1],
					"screens": [[1, 1]]
				},
				"serverCache": false,
				"useManifest": false,
				"compress": true,
				"postprocessors": {
					"css": "less",
					"js": []
				}
			}
		}
	}
}
```

The `access` property for your application describes the access level up to which user commands
should be exposed. The checks needed to ensure security do not depend on this setting.

By setting `disabled` to true, you can prevent the app from being created. By default, every app
mentioned under `apps` in your configuration will be enabled.

The `clientConfigs` object is no different from what you used to feed into the `WebApp` constructor.
The structure you see in the example above is also the default, so you may leave it out completely.

Because you no longer create the WebApp instance yourself, you need another way to access it, so you
can register pages on it, etc. You have access to the apps from the moment your callback from
`mage.setup()` runs. That callback is now given two arguments:

```javascript
mage.setup(function (error, appsMap) {
	// appsMap is a key/value map that contains:
	// { gamename: WebAppInstance, tool: WebAppInstance }
});
```

The `readyToStart` event that fires on the `mage` instance also carries this key/value map as its
only argument. Alternatively, apps can be accessed through the following APIs:

```javascript
var myApp = mage.core.app.get('gamename');
var myArrayOfApps = mage.core.app.getAppList();
var myMapOfApps = mage.core.app.getAppMap();
```

#### Migration

To update your user commands to be set to "user" access level, save this script in a file inside
your `lib/modules` folder and run it from there. This will add the following code to all your user
commands that do not have "import" in their name (since those should be "admin" level):

```javascript
exports.access = 'user';
```

Please adjust this script according to your needs of course.

```bash
#!/usr/bin/env bash

function insertBeforeFirstExports () {
  file=$1;
  payload=$2;

  line=$(grep -n export ${file} | head -n1 | cut -d':' -f1);

  grep "${payload}" "${file}" > /dev/null && return 0;

  sed -i "${line}i ${payload}\n" ${file};
}

for file in $(ls */usercommands/*.js | grep -v import); do
  insertBeforeFirstExports ${file} "exports.access = 'user';";
done
```


### Configuration

The new configuration loader is here! Read all about it [here](./lib/config/Readme.md). There are
some big changes in how configuration is loaded, so you *will* need to read this. The resulting
object is essentially the same though, so conversion should be simple to do.


### MMRP

Fixed a bug with msgServer that caused events to not be emitted on the client when an event was
stored after an event had already been emitted to the client and the communication channel
disconnected.


### ClientHost configuration

The "expose" config entry for "clientHost" is now encouraged to be a full URL string. Even a partial
path is allowed if you're behind a proxy that demands it.

This means that both of these are valid:

```json
{
	"server": {
		"clientHost": {
			"protocol": "http",
			"transports": {
				"longpolling": { "heartbeat": 60 }
			},
			"bind": { "file": "./server.sock" },
			"expose": { "host": "mygame.myname.node.wizcorp.jp", "port": 1234 }
		}
	}
}
```

```json
{
	"server": {
		"clientHost": {
			"protocol": "http",
			"transports": {
				"longpolling": { "heartbeat": 60 }
			},
			"bind": { "file": "./server.sock" },
			"expose": "http://mygame.myname.node.wizcorp.jp:1234"
		}
	}
}
```

### Archivist

#### Cleanup

Vaults are now more cleanly closed on MAGE shutdown.

#### FileVault

Meta information is now stored in separate `.filevault` files alongside the files that contain the
actual data that you store.


### Other small improvements

Changed the generated usercommands to use new Function so that developers can see what parameters
are available for the usercommand.

The component-builder package got bumped to the latest version + a patch by Micky that solves an
annoying bug [see: pull request](https://github.com/component/builder.js/pull/81).


## v0.12.2

Fixed a bug that prevented master and worker processes from finding each other in MMRP.
This bug was introduced in v0.12.0, so everybody using either v0.12.0 or v0.12.1 is encouraged
to upgrade!


## v0.12.1


### `useModules` enhancement

You asked, and we listened! `useModules` can now take arrays as arguments. You can still have as
many arguments as you like, and you can mix and match arguments with module names and arrays of
module names however you like.


### Bot module

The bot module finally landed in MAGE (`lib/modules/bot`). It's accompanied by a
[./lib/modules/bot/Readme.md](./lib/modules/bot/Readme.md) that should help get you started.


### Moved User Command Response Cache into Archivist

The user command response cache that is built into the command center protects your users from bad
TCP connections dropping their data. It makes sure that under all circumstances, your client state
stays consistent with the server state. This system has now been moved to Archivist, so to use it,
please expose the two topics `ucResponseMeta` and `ucResponseData` in your `lib/archivist` in a
manner similar to this:

```javascript
exports.ucResponseMeta = {
	index: ['session'],
	vaults: { memcached: true }
};

exports.ucResponseData = {
	index: ['session'],
	vaults: { memcached: true }
};
```

If you want to change the TTL for this cache, you can do this per application you expose. This used
to be done through `myApp.commandCenter.responseCacheTTL = 123;`, but that no longer works. The TTL
is now defined in seconds in your configuration as:

```json
{
	"apps": {
		"mygame": {
			"responseCache": 180
		},
		"tool": {
			"responseCache": false
		}
	}
}
```

A number will be used for TTL, false will indicate that you don't want to apply any response cache.


## v0.12.0


### Mithril is now called MAGE!

This also means that the module you require is no longer called `mithril`, but is now called `mage`.
Here are some handy scripts to help you fix up your code:

To replace selected instances (MAC OS X):

```bash
for file in $(grep "mithril" -r ./* | awk -F '\ |:' '{print $1}' | uniq); do sed -i '' "s/mithril./mage./g ; s/window.mithril/window.mage/g; s/var mithril [\ ]*=/var mage =/g; s/require('mithril')/require('mage')/g; s/\/mithril\/node_modules/\/mage\/node_modules/g" $file; done
```

To replace selected instances (Linux Flavour):

```bash
for file in $(grep "mithril" -r ./* | awk -F '\ |:' '{print $1}' | uniq); do sed -i "s/mithril./mage./g ; s/window.mithril/window.mage/g; s/var mithril [\ ]*=/var mage =/g; s/require('mithril')/require('mage')/g; s/\/mithril\/node_modules/\/mage\/node_modules/g" $file; done
```


### Archivist

DataSources and PropertyMaps have been superceded by the Archivist library and module. You are
highly encouraged to use Archivist from now on, since DataSources will be removed in a future
release. Learn more about Archivist in [./lib/archivist/Readme.md](./lib/archivist/Readme.md).


### Daemonization

Mage now supports daemonization out-of-the-box. That means that you can control your application's
runtime by passing a command on your command line. Run `node . help` to get a list of commands.


### Module removal

The following modules have been removed:

 * appleAppStore
 * gc
 * giraffe
 * history
 * manage
 * msg
 * npc
 * obj
 * persistent
 * score
 * shop
 * sns

You can retrieve them from the v0.10.2 of Mage if you still want to use them.


### Module loading

Mage `addModule` and `useModule` are now deprecated. A universal `useModules` command is now provided to
handle both game and mage module use. The new system is based on the concept of a search path. This is best
shown by example:

```javascript
var mage = require('mage');

// Add a path to search for modules in.
mage.addModulesPath('./lib/modules');

// useModules takes one module per argument.
mage.useModules(
	'gm',
	'session',
	'actor',
	'assets',
	'player',
	'scheduler',
	'tinyModule'
);
```

Mage already knows where to look for core modules, but you need to tell it where to look for your game modules
using `mage.addModulesPath`. You can add more than one modules path if you like; the order in which you add
them is the order in which they will be searched for a module. Core modules are always checked last, so you
can override them easily. Of course, the name must resolve to a module!

Some mage methods are chainable, so if you prefer it the previous snippet can be rewritten as:

```javascript
var mage = require('mage').addModulesPath('./modules').useModules(
	'gm',
	'session',
	'actor',
	'assets',
	'player',
	'scheduler',
	'tinyModule'
);
```

This is a breaking change, but easy to implement. `addModulesPath` can optionally take more than one path as
arguments, although it would be unusual to use more than one.


### Deprecated: app.expose()

Apps are now automatically exposed, so calls in your bootstrap sequence to `myApp.expose` and
`tools.expose` should be removed.


### Booting mage

Booting mage can be done in a more event driven way if you choose (if you choose not then you don't need to
change anything). In short, the `callback` argument in `mage.setup(configs, callback)` is now optional. You
can instead listen for the `'readyToStart'` event on `mage`.

#### Method 1

You already use this method.

```javascript
var configFiles = ['./configs/custom.json'];

function start() {
	// Your exposures etc.
	var app = new mage.core.app.web.WebApp('sandbox', { languages: ['en'] });
	app.commandCenter.expose({}, { scheduler: ['runTask'] });

	mage.start();
}

mage.setup(configFiles, start);
```

#### Method 2

If you like, you can do the following instead.

```javascript
var configFiles = ['./configs/custom.json'];

function start() {
	// Your exposures etc.
	var app = new mage.core.app.web.WebApp('sandbox', { languages: ['en'] });
	app.commandCenter.expose({}, { scheduler: ['runTask'] });

	mage.start();
}

mage.once('readyToStart', start);
mage.setup(configFiles);
```

This is verbose, and not to everyone's taste, but it's more in line with how node.js core modules work.


### A new logger

Mage has been outfitted with a new logger. It is backwards compatible. However, in order to make
good use of it, you should be using its extended API. For starters, there is now a logger module,
read about it in [./lib/modules/logger/Readme.md](./lib/modules/logger/Readme.md).

#### Migration

To have access to the logger module, initialize it as any other built-in module:
`mage.useModules('logger');`

This module should also be included on the HTML5 client side, which enables you to do more powerful
logging there as well.

When you use the logger module, you should always access the logger through `mage.logger`, **not**
`mage.core.logger`, which is now reserved for MAGE's internal use.


### Sampler

The sampler library is an interface for Panopticon. It uses configuration to handle the setup of panoptica,
and exposes the methods of these panoptica as a group. Sampler handles the sending of data to all of the panoptica,
so you only need to worry about the API:

 - `sampler.set(path, id, n)`, where `n`, a finite number, may replace a previous `n` for this `id`.
 - `sampler.inc(path, id, n)`, where `n` is added to the previous value if `n` is a finite number. If `n` is not
a finite number, then it defaults to `1`.
 - `sampler.sample(path, id, n)`, which keeps track of the max, min, average and standard deviation of `n` over an
interval.
 - `sampler.timedSample(path, id, dt)`, which is like sample, but takes the output of a high resolution timer `dt`
(or rather the difference between two timers).

These methods take the same arguments as a panopticon, so please see the Panopticon documentation for more detail.

The sampler needs some configuration. To the top level of your custom config file, add something like:

```json
{
	"sampler": {
		"intervals": {
			"observium1": 2500,
			"observium2": 30000
		},
		"bind": { "protocol": "http", "file": "./stats.sock" },
		"sampleMage": true
	}
}
```

where the key-val pairs in `"intervals"` are named intervals and their durations (in ms), `"bind"` defines a
socket or address to serve sample data from (this may be optional in the future, as what you see should be the
default), and `"sampleMage"` turns on the sampling of mage internals.


### Smarter multi-server connections

Servers (master process) connecting to other servers (mmrp) will now validate that their peer is
running the same version of the game (driven by your package.json) as itself. If the version is not
exactly equal, they will not connect.

This feature is useful when doing a rolling restart of your game, when launching a new version.
You wouldn't want the new version to start connecting to the running instances that are being shut
down.


### Built-in JSON linting

If there is a parse error in your configuration JSON file(s), the lint-result will be output
immediately. This should save you time when trying to find the error.

You may also access this JSON parser helper yourself, by calling:
`mage.core.helpers.lintingJsonParse('jsonstring');`. This function will throw an Error
containing the human readable lint-information in its `message` property.


### Dependency changes

#### tomes

An evented storage agnostic data API. You can find it here: https://github.com/Wizcorp/node-tomes

#### rumplestiltskin

Gives you the power to use a JavaScript Object as a key. You can find it here: https://github.com/Wizcorp/node-rumplestiltskin

#### panopticon

Panopticon handles data collection across the node.js clustered application. Sampler makes use of this.
You can find it here: https://github.com/Wizcorp/panopticon

#### mysql

Updated from v0.9.1 to v2.0.0-alpha7

#### memcached

Updated from v0.1.4 to v0.2.2

#### zmq

Updated from v2.2.0 to v2.3.0

#### epipebomb

The epipebomb module was added to suppress EPIPE warnings on stdout and stderr, which are innocent,
but regularly happen when you start piping your output to another process (like grep).


### Small refactoring

#### Mage core module

Changed the mage.isShuttingDown boolean to mage.getRunState(), which returns a string changing
from `init`, to `setup`, to `running`, to `quitting`.

Moved the app version information into `mage.rootPackage`:

```json
{
	"name": "game name",
	"version": "0.1.2"
}
```

#### Builder

There was a built-in builder type called "configDirBuilder", which has been removed. That builder
took a config entry, and interpreted it as a path, then started including that path. The same can
be achieved by embedding: `$dir($cfg('entry'))`.

The manifest builder now successfully builds manifests again.

#### Benchmark

The benchmark helper function has been moved into `mage.core.helpers.benchmark`, and now
measures execution time in nanoseconds.

#### Lint!

MAGE now lints 100%!
Small sidenote: tool dependencies like jQuery obviously don't lint.


## v0.10.2

### wizAssetsHandler

wizAssetsHandler can now retry failed downloads. It does this by default up to 3 times, with 50
milliseconds in between tries. You can set up the retry behavior per download phase. The options
you give when calling setPhase() have been augmented with:
- "retries": integer, use Infinity to make it never stop retrying
- "retryDelay": integer, msec between each try

The following events have been added to wizAssetsHandler:

- "retryDownloadFile" (phaseName, retriesRemaining, asset): A download failed, and is being retried.
- "failedDownloadFile" (phaseName, error, asset): All retries failed.

### Shokoti

Shokoti configuration has been changed a bit, when using HTTP basic authentication. Since basic
authentication has become part of the clientHost configuration (see v0.10.1), Shokoti client now
uses that in its communication with the Shokoti server. That means that the "callbackAuth" entry
is no longer needed. Please remove it if you used it.

### Directory builder consistency

When building the frontend pages, directories are scanned and aggregated by the DirBuilder. This
builder was not sorting the files and directories it read, so it was possible that a build on
server A looked different from the one on server B. This inconsistency causes cache to be much less
effective (although we don't have any numbers on this). If a game's file dependencies are poorly
managed, it could even cause bugs in your game.

This has now been resolved. When directories are scanned, files and subdirectories are now always
returned in alphabetical order.

### Smaller fixes

* Basic auth rules were not being applied to user commands and msgstream.
* Better logging of 404 errors on the server side (goodbye 'app "foo" not found').
* Bad incoming HTTP requests are now detected more reliably and logged more clearly.
* EventEmitter#once was not passing along the 4th argument (thisObj) to EventEmitter#on.
* node-memcached updated from 0.0.11 to 0.1.4.
* node-memcached-transactions updated from 0.1.0 to 0.1.1.


## v0.10.1

### $cfg() builder change

$cfg() build entries now contain quotation marks around strings (they are JSON.stringify() output).
That means you can no longer write: `var a = 'hello $cfg(myname)';`.
Instead you'll have to write: `var a = 'hello ' + $cfg('myname');`.

### State timeout

State objects can now time out. The Command center sets this up automatically for states it creates
for each user command call, if you have it set up using the following API:
`myApp.commandCenter.setUserCommandTimeout(30 * 1000);`.

### Basic auth support on clientHost expose config

Adding the properties "authUser": "myname", "authPass": "123" to your clientHost's expose config,
will notify the loader and I/O system to inject a header into their HTTP requests.

### GREE purchase improvements

Retrying a purchase will no longer fail, but return the already acknowledge purchase record, like
a normal purchase would.


## v0.10.0

### Node.js 0.8+

#### Cluster

This Mithril release has been adjusted for Node.js 0.8 compatibility. The biggest change
is in the cluster implementation, which is no longer an external dependency, but comes with
Node.js instead. It's more powerful and now accepted as the one true way to spawn workers.

#### zlib

Node.js 0.6+ comes with a built-in zlib library, which behaves much better than others which
are available through npm. Mithril now uses this zlib library both for compressing the built
frontend code, and for compressing big user command responses.

### Error logging with State

state.userError() is now officially deprecated. Please only use `state.error(code, logMessage, cb)`
where only the logMessage is optional (null or undefined). The code will always find its way
to the response callback on the frontend.

State objects received a `setDescription(str)` method, which allows one to add context to a state's
error messages. The command center by default sets the description of its states to "moduleName.userCommand".

### New assets system

Assets are now automagically registered from the repository. You still need to create
an `AssetMap` object, then call its `addFolder()` method. Contexts, languages and
asset variants (retina, etc) are automatically detected based on the folder structure.
The path to an asset must be of the form
`folder/context/language/descriptor[@profile1,profile2,...].extension`. Just like before,
`descriptor` can point to the depths of some subfolder (e.g. `ui/buttons/button1`).
Profiles are symbolic names that map to a set of requirements defined in the config file.

#### Configuration example

```json
{
	"modules": {
		"assets": {
			// These can also be passed in the object accepted by AssetMap's constructor,
			// Also, if you want different configs for different asset maps while still having
			// all the config here, you can name your asset maps and put all these in
			// modules.assets.maps.<name>.<baseUrl|uriProtocol|cacheability|profiles>
			"baseUrl": {
				"img": 'http://somewhe.re/img'
			},
			"cacheability": {
				"img": [
					// Maps regexes to cacheability. Order defines precedence.
					["^ui/boss/", 50],
					["^ui/", 0]
				]
			},
			"profiles": {
				"retina": {
					// Each value here is optional
					"density": 2,        // match if client's density >= 2
					"screen": [320, 480] // match if client's screen >= 320x480
				}
			}
		}
	}
}
```

#### Asset folder example

```
mygame/
	assets/
		img/
			default/  # default language and common stuff
				ui/
					boss/
						boss1.png
						boss1@retina.png
					button1.png
					button1@retina.png
			ja/ # Japanese localized stuff
				ui/
					button1.png
```

#### WebApp creation

You must tell your webapp what client configurations to support, so that it can
pre-build mithril pages for all the different clients. This is done by passing
`languages`, `densities` and `screens` to the constructor like this:

```javascript
var app = new WebApp('game', { languages: ['en', 'ja', 'fr' ], densities: [1, 1.5, 2], screens: [[320, 480]] });
```

When omitted, `languages` defaults to `['en']`, `densities` defaults to `[1]` and
`screens` defaults to `[[1, 1]]` (it's a minimum requirement that will match all
screen sizes). The above also makes `en` the default language and `1` the default
density in the generated loader code.

#### AssetMap creation

```javascript
var assets = new mithril.assets.AssetMap();
assets.addFolder('assets');
// etc
app.addPage(...., { assetMap: true });
// start your game
```

#### Page assets (popups etc)

You can register popups using `AssetMap.prototype.addPage(context, descriptor, path, version, cacheability)`
like this:

```javascript
['popup1', 'popup2', '...'].forEach(function (id) {
	assets.addPage('popup', id, '/' + id, 1, 3);
	app.addIndexPage(id, 'www/pages/' + id, { route: id });
});
```

`version` is optional and defaults to 1. `cacheability` is optional too and defaults
to the default cacheability.

#### Limitations

In the current version, only one file format per asset is supported. Thus, if two
files resolve to the exact same asset but have different extensions, only the last
one will make it into the asset map. In a future version the module will pick the
best format for the client platform (e.g. `aac` for iOS, `mp3` for Android, etc).

### Mithril loader changes

The Mithril page loader has been augmented with a "maintenance" event. This event fires when a server
responds with a 5xx HTTP status code during page retrieval. The contents and content-type will be emitted
with the event, so that customized messages can be displayed during a game's downtime. For example:

```javascript
mithril.loader.on('maintenance', function (msg, mimetype) {
	// msg: the content of the response
	// mimetype: the content-type header of msg
});
```

### GREE

We made the gree configuration environment aware. That means you can put the following in your base.json config:

```json
{
	"module": {
		"gree": {
			"environments": {
				"sandbox": {
					"consumer": {
						"key": "i got the key",
						"secret": "i got the secret"
					},
					"appId": "31337",
					"endpoint": "http://os-sb.gree.net/api/rest"
				},
				"production": {
					"consumer": {
						"key": "i got another key",
						"secret": "i got another secret"
					},
					"appId": "12345",
					"endpoint": "http://os.gree.net/api/rest"
				}
			}
		}
	}
}
```

And in your environment's config file add:

```json
{
	"module": {
		"gree": {
			"env": "sandbox" or "production"
		}
	}
}
```

#### Also:

* Bugfix: a few error cases in the GREE module's purchase handler would not close the state object.
* The GREE module was not storing orderedTime and executedTime properly.

### These smaller features

* Every user command now emits "io.CommandName" events on its module, receiving 2 arguments: response, requestParameters.
* Added a `mithril.getModule(name)` method which returns a module object (almost the same as: mithril[name]).
* TimedState (client) when emitting the change event, now also emits a 2nd argument which is the full next change description.
* PropertyMaps on the client now have a `count()` function to count properties.
* CommandCenter now time-logs execution time of individual user commands.
* Mithril's version is now exposed on `mithril.version`.
* The page builder got a huge speedboost when building webpages.
* wizAssetsHandler now has a `deleteAllFiles(cb)` method which does what the name implies, which can be useful for testing.
* The assets module client method "applyAssetMapToContent" now also rewrites mui:// URLs in webkit-border-image and border-image rules.
* Shutdown has become much more graceful, allowing for more controlled datasource connection management.
* Increased default I/O timeout on the client from 10sec to 15sec.

### Bugfixes

* A few bugs in the scheduler were fixed that would leave state objects open.
* An iOS6 aggressive caching bug has been circumvented by always responding "Pragma: no-cache" even to POST requests.

### EventEmitter bug

A bit of special attention to a bug that got fixed in the client side EventEmitter class. Removing event listeners from the
event emitter while emitting could cause certain event handlers not to be called. This affects everybody, since the EventEmitter
library sits in the loaders. To fix this for olders builds, please re-include the new EventEmitter from the "FrontEnd" repository,
where it's also been published. Reincluding this file will not destroy any existing EventEmitters, it will simply override their
logic.


## v0.9.1

### Shokoti

The Shokoti scheduler libraries have been integrated! Please refer to the Shokoti repo for more information on how to use it.

### EventEmitter

* The `EventEmitter.on/once` methods now receive an optional extra parameter that identifies the this-reference for your event handler.
* Added a `EventEmitter#hasListeners(evt)` method that returns `true` if any listeners for `evt` exist, `false` otherwise.
* If `removeListener()` was called during emission of that same event, an error was caused.

### TimedState

* TimedState can now get a custom interval whenever the state gets set manually.
* TimedState#getCurrentState(true) will now not just give the state, but an object that contains state and the time at which it got that state.

### LivePropertyMap

* LivePropertyMap#countAllExistingProperties() will return the amount of properties that exist (regardless of having been loaded).
* Certain issues surrounding the stricter LivePropertyMap have been addressed (gc node progress, among others).

### Other improvements

* Giraffe was sometimes responding with Error objects, which cannot be transported through the HTTP server, causing an error.
* The code behind `wizAssetsHandler.analyze()` has been optimized to use less memory.


## v0.9.0-1

Hotfix that should address a login issue in the giraffe module. You are advised to confirm the correct behavior of login for new
users and existing users into giraffe.


## v0.9.0

### New GREE module

We have replaced the old GREE module that was Japan-only, with a module that will work with the GGP system. It's a work in progress,
so you can definitely expect many updates for it in the near future.

### IO subsystem changes

The IO subsystem has been simplified and improved. This means it will be more predictable in its behavior, but also requires a
slightly stricter error handling strategy by game developers.

#### Error handling

Instead of "server error" and "user error", on the client we now differentiate between transport error and normal errors.

*Transport errors*
The transport errors apply to the entire batch of user commands, and are expressed through the `io.error` event that you are already
familiar with.

There are 3 transport errors:
* io.error.auth: when authentication failed (mithril.io.discard() and re-authentication required).
* io.error.network: when there was a transmission failure (mithril.io.resend() required).
* io.error.busy: you were executing a user command while another batch was already being executed (nothing required here, this is a simple notification).

As you may have noticed, there is now a mithril.io.discard() method. What this does is throw away the last command batch. Unless
`mithril.io.discard()` or `mithril.io.resend()` is called, the command system will be waiting in a locked state (so be careful!).

This means that on every "io.error" event you will call one of these 2 methods. If you want user interaction to make the resend choice,
you can call them asynchronously without problems.

*Normal errors*
Errors that originated inside of the game flow will always end up in your callback. There is no need to call io.discard() here, since
that is done automatically. Before your callback is called, the IO system is always unlocked. So keep in mind, the typical "server"
errors will now definitely end up in your callbacks!

#### Queueing user commands

A new feature is queueing! That means that you can safely queue up user commands (on a per-case basis) while others are being executed.
This is useful in cases where you really cannot anticipate if another command is already running or not. An example:

```javascript
mithril.io.queue(function () {
	mithril.quest.doQuest(function (error) {
		// etc
	});
});
```

This will instantly execute your function, but any user commands that get called will be queued up until they can be executed. If
they can be executed immediately however, they will be, so there are no needless delays. The reason why there is a special API for
queueing is that without it, button bashing would cause queuing to occur, which is not desirable. Instead, they will still generate
a "io.error.busy" error.

#### Event flow for overlays

The IO system emits a bunch of events, and `io.discarded` has been added to this list. So in order to make nice blocking overlays,
you can listen to these 2 events, which are guaranteed to be called sooner or later:
* io.send: we're on our way to the server (show overlay).
* io.discarded: the command queue was discarded successfully (hide overlay).

Some added candy:
* io.resend: we're (again) on our way to the server (render "retrying..." inside overlay).
* io.response: this happens right after the queue got discarded, and we're about to call our command callbacks (not too useful).
* io.queued: a queue just got created, since we're already talking with the server (not too useful).

#### Event flow for error handling

```javascript
mithril.io.on('io.error.network', function () {
	overlay.writeStatus('Please make sure you are connected.');

	window.setTimeout(function () { mithril.io.resend(); }, 5000);
});

mithril.io.on('io.error.busy', function () {
	console.warn('Silently ignoring IO busy case.');
	// not discarding the active command list, since the busy error was triggered because commands were already being sent
});

mithril.io.once('io.error.auth', function () {
	window.alert('Your game session expired, reloading...');
	window.location.reload();
});
```

### Introducing Memcache (config required!)

The command center now caches to memcache, instead of membase. It should be much more efficient now, and have no more negative
impact on the in-memory caches that membase uses for the values related to your players.

This does mean we need to configure an extra datastore.
Please add a data config entry, following these steps:
- copy "kv", but call it "kvcache"
- change the port to 11911
- keep the prefix the same

Notify the team that deploys your code into production that config has changed!

### wizAssetsHandler

The wizAssetsHandler has received some power ups. Backwards compatibility is maintained, but instead of calling `run()` and having
everything happen on the auto-pilot, there is now a way to download the assets in a more controlled way.

`wizAssetsHandler.analyze(function (error, deleteList, downloadPlan) {})`
The analyze function returns an array with files to be deleted. The download plan object contains all phases that will have to run.
The phases describe which assets will be downloaded when.

`wizAssetsHandler.deleteFiles(deleteList, cb)`
The deleteFiles function deletes all the files you feed it. This should basically always be the list returned by the analyze function.

`downloadPlan.runAllPhases(cb)`
The download plan will run all phases that have not yet run.

`downloadPlan.runPhase(phaseName, cb)`
With this function you control exactly when phases run, one by one.

`downloadPlan.resetCounters()`
Resets the downloadPlan.totalDownloads and downloadPlan.downloadProgress counters to exclude the assets that have already been downloaded.

### LivePropertyMap

When opening a LivePropertyMap object, the options you pass it have changed a little bit. Properties mentioned in `{ load: ['a', 'b'] }` are now
no longer treated as optional. That means some of your existing code *will break*! You can make properties optional by describing them as such:
`{ load: ['a', 'b'], optional: ['c', 'd'] }`. This does mean you will no longer have to check if a non-optional property was returned or not.
It is guaranteed to have been returned, else it would have triggered an error......

### Small improvements

* Added LivePropertyMap#getAllExistingProperties() (no arguments) method that returns an array of all parsed property names, even the ones not loaded.
* TimedValue (server side) now has a setInterval(interval) method.
* The shop client now has a getShopsByType(type) method that returns an array of shop objects that match the given type.
* The obj module's sync method is no longer required to be exposed.
* The obj module will now trigger an error when trying to remove a non-existing object from a collection.
* Sessions can now be expired on demand by calling session.expire(state, cb);
* Improved error logging in zeromq.
* The loader now has a getPage(name) function that returns the DOM element for the page.
* Added mithril.assets.getAllFromContext(name) function on the client that returns an array of asset objects.
* Added improved error logging to Giraffe.
* Added better error logs for membase connection issues.
* Added error messages to commandCenter caching.
* Client side property maps now emit one more argument on set/del: previousValue.
* Giraffe module now does a more aggressive check for user existence.
* GC: exposed addOutConnectors() for use with import scripts.
* Expose replaceNpcData for import scripts.
* Assets client module can now replace fonts live on a stylesheet object, just like it does with background images.
* Updated node-memcached to v0.0.11.

### Bugfixes

* Fixed a bug in wizAssetsHandler that prevented assets from being downloaded.
* Failing to cache a page due to a full localStorage threw an exception and broke the flow.
* Fixed a bug in the loader that prevented a mithril-page with an empty HTML block to be rendered.
* Emitting undefined on the server no longer breaks.
* Added check in livePropertyMap that verifies that the propertykeys result is an actual string.
* Membase now bails out when the retrieved value is a boolean "true", which might be a bug in node-memcached.
* obj.getCollectionActors() was not applying language filters correctly.


## v0.8.1

### pauser module

A module called "pauser" has been added. For those familiar with multi threaded programming, pauser allows you to create mutex locks,
with the added benefit that you can wait for any amount of locks at once. What this means is that you can create a context (a lock) by
calling for example: `mithril.pauser.start('quest');`. When you have pieces of code that may execute fine, but need to be put on hold
if the "quest" context is active (for example, updating an XP value on screen when XP changes), you can write:

```javascript
mithril.actor.on('xp.set', function (value) {
	mithril.pauser.wait('quest', function () {
		xpLabel.innerText = value;
	});
});
```

If there is no quest active, the pauser will immediately call the given function that updates your XP label. But if the quest is
active, it will wait until `mithril.pauser.end('quest');` is called.

Some extra features:
* You can wait for multiple contexts by calling `wait(['one', 'two', 'three'], function () {});`.
* You can specify a timeout after which the wait *must* continue, by passing milliseconds as the third argument in `wait()`.

### TimedNumber

The inc and dec methods on a TimedNumber (server side) have received an extra parameter to allow truncation of the number to the
range limits. So when incrementing by 10 oversteps the bounds, it will quietly limit it to the bounds, instead of fail. This can
be achieved by giving `true` as the third parameter in: `TimedNumber#inc(size, time, allowTruncation)` and
`TimedNumber#dec(size, time, allowTruncation)`. Instead of `true`, the applied delta is now returned by these methods.

### obj module

New method: `obj.getChildCollections(state, parentId, cb)` returns all collection records that have a given parent collection.

### Bugfixes

* The HTTP transport errors "busy" and "network" (on timeout) that were generated by the client were not formatted well. Other
error codes were wrapped in { reason: 'errorCode' } objects. These two errors now also follow this format.
* `players.getPlayers` with an empty array of ids now yields an empty result instead of an SQL error.


## v0.8.0

### DB changes in shop and npc modules

Have a look at db/changes.sql for the latest migration queries.

### Session invalidation

Changing the backend code version through `mithril.session.setCurrentVersion(version, message)` will invalidate all sessions
that were not created on that version. Specify a string as a message to display to users. For multilanguage purposes,
message may also be of this format: `{ EN: 'foo', JA: 'baaru', NL: 'kom op nou!' }`.

### TimedState datatype

Mithril now exposes a TimedState datatype. It behaves quite similar to TimedNumber, but you use it to create time-driven state machines.
An example:
- The farm is idle by default.
- The player can sow the field, after which the farm is growing.
- After growing for 60 minutes, the farm becomes ready.
- When ready, the player can harvest after which the farm becomes idle again.

This flow contains 3 states: idle, growing and ready. Growing is time based, the others do not change over time but require user input.
TimedState allows you to implement this in a very simple way. When creating a TimedState, you call the following:

```javascript
var farm = mithril.core.datatypes.createValue('TimedState', {
	states: {
		idle: null,
		growing: [60 * 60, 'ready'],
		ready: null
	},
	stored: { state: 'idle' }
});
```

This creates a farm value that is idle, until `farm.setState('growing');` is called. After 3600 seconds, the state reported by
`farm.getCurrentState()` will automatically switch to ready. After harvesting, you would be expected to call `farm.setState('idle');`.

### TimedNumber bugfix

Fixed a bug in TimedNumber that would corrupt the data when `setRange()` or `setIncrement()` was called.
To the best of my knowledge, no games used this API yet. From now on, they should use it though.

### chooseWeighted

The mithril.core.helpers library has a new function: `chooseWeighted(spec)`. The `spec` parameter is a collection of key/value pairs
where the key is a name, and value is a weight (integer). The function randomly returns one of the keys of the given spec,
based on each key's weight. It returns null on error or if there was nothing to be chosen.

### SNS

Added an API for removing multiple relation requests (array of IDs) at once: `sns.delRelationRequests(state, requestIds, cb)`.

When resetting an SNS relation, the new creationTime was not being sent to the client.

### LivePropertyMap

LivePropertyMap now has an `exists(propertyName, language || null, tag || null)` method. Before, there was already a `has()` method
like that. The difference is that `has()` responds false if the property is not loaded. The exists() method will respond true, even
if the property has not been loaded, but is known to exist.

A new `getAll(language || null, tag || null)` method has been added that returns all properties in a simple `{ name: value }` map.

Before, on the client livePropertyMap delete-events would only emit through a `del.propertyName` event. Now you can also catch
every delete operation on the property map, by listening for `del`. The arguments it receives are propertyName and value.

Improved stability and performance of the LivePropertyMap.

### Assets

Assets on the client side now have a `Asset#getContents(httpOptions, cb)` API to download the actual data of a file. This will be
useful for downloading gettext translation files for example. The callback receives an `error` argument, and a `data` (string)
argument.

The client module's `applyAssetMapToContent(content)` method can now also replace background images in `CSSStyleSheet` and
`StyleSheetList` (DOM) objects, no longer just strings.

### Shop and appleAppStore

Shop now sets a `forActorId` property on the lastPurchase object.

The appleAppStore API now has a `purchaseWithoutReceipt` method and user command that can be used from the tools to give players
a free "purchase".

### NPC module change

Removed mithril.npc.addNpc and mithril.npc.editNpc since they were untested and wrong.
Added mithril.npc.replaceNpc() that will add an npc if not existent and replace it if existent.

Other code has been refactored and should run better now.

### Players tool

Fixed pagination in the players module and added a sort (asc/desc) option. The tool now reflects this in that it always shows the latest players
(descending), and the button for creating new players has thus moved to the top of the list.

Fixed the bug where clicking on the active page tab would hide the entire tool's contents.

### Small changes

* Every time a gc node's progress was being set, it was also needlessly being loaded.
* Fixed a bug that would break the logger if no error channel was defined in the configuration.
* State objects no longer rely on the session module being loaded. This is useful for offline scripts that cause events, but don't need to emit them.
* The obj.collection.edit event now sends back the id of the collection.
* TimedState and TimedNumber now always emit their changes asynchronously. Even when the change comes from the server, a setTimeout of 0 is used, so that other data can be updated before event handlers fire.


## v0.7.0

### Player language (DB change!)

The player module no longer has anything to do with language. Language is now stored on the actor. That means that the following APIs have changed.

- `mithril.actor.addActor(state, name, language, cb)` now receives a language code which is stored as an actor property called "language".
- `mithril.player.addPlayer(state, actorId, vipLevel, cb)` no longer receives a language code.
- `mithril.player.getPlayer` and `mithril.player.getPlayers` may no longer ask for language.
  `getPlayers` still loads all actor properties however, and language is among them (but not for old players!)

Please make sure your games do not use these APIs, or update how they are used.
Everyone: there has been a DB change, please apply!

### Obj API extensions (server side)

- `mithril.obj.getCollectionTypeById(state, id, owner, options, cb)` for getting just the type of a collection.
- `mithril.obj.findCollectionById(state, collectionId, cb)` is like getCollectionById, but is allowed to fail.

### File uploads

The I/O system now allows you to upload files (the HTML5 `File` class) as user command parameters. On the Node.js side, the parameter value will
become an array of `Buffer` objects that contain the data. You have to take care of joining these together yourself. This is not a useful feature
for games, but it is for the tools, which can now use this mechanism to import data files. Later, the asset management in the tools will also be
able to use it. Browser requirements for this to work: availability of `File` and `FormData` classes (on window). Tested to work on Chrome. We may
be able to expand browser support at a later time.

### GC module

For tools and data import logic, we have enhanced `gc.editNodes` to accept nodes based on an identifier instead of an id (the user decides which to
provide). Also, following the same API as `addNodes` and `editNodes`, a `replaceNodes` API was added that does create or update based on existence.

On the client side, gc nodes now have the following 2 functions to find nodes (not IDs) over out connectors:
- `getOutNodes(connectorType, [onState])` for quick lookup of nodes.
- `getOutNodesToSelf(connectorType)` for quick reverse lookup of nodes. This one in particular is very fast and useful.

### LivePropertyMap

We've added a function `LivePropertyMap.prototype.load({ options }, cb)` that behaves like the LPM constructor and allows you to load extra
properties into the LPM at a later time. The options are the same as when you normally create an LPM, eg: `{ load: ['some', 'property', 'names'] }`.
If certain properties had already been loaded before, they are skipped, so you don't have to worry about double loading.

### Bugfixes

- ObjCategory.prototype.getObjects() should now only return objects that are in a collection owned by the player.


## v0.6.7-1

### SNS module hotfix

- Many SQL rewrites in SNS that should make it a lot faster to execute.
- When auto-connecting a relation request, we were double checking the existence of the relation. This is now fixed.
- Bidirectional relations now always have the lower actor ID as "actorA", and the higher actor ID as "actorB". To update
  your database, please run the following query for each of the bidirectional (!!!) relation types:
  UPDATE sns_relation SET actorA = (@tmp:=actorA), actorA = actorB, actorB = @tmp WHERE actorA > actorB AND type = 'MY_BIDIRECTIONAL_RELATION_TYPE';


## v0.6.7

### WebApp object improvements

#### Adding full HTML pages to your app

Previously, an app could only expose a single full HTML "file", through the `myApp.setIndexPage()` API. This method still
exists, but preferably, you now use `myApp.addIndexPage(pageName, pathToPageFiles, options)`. The API is the same as
`setIndexPage()`, except that the `pageName` argument and the `route` option must be provided. The page name is to identify
the page for logging and debugging purposes. The route option is a sub-route on top of /app/appName that allows you to expose
the built page any way you want. Alternatively, it accepts an option `routes`, which is an array of sub-routes.

#### Route exposure

WebApp objects now expose a `route` property, which is the route at which the loader can be accessed. This is useful when
creating a URL to the loader, so you can avoid needless constant string duplication (eg: "/app/mygame").

### Bugfixes

- If events are emitted to an undefined actor, this will now ignore the event. This was a problem in Node.js tools.
- LivePropertyMap now outputs an error when trying to write undefined.
- If there was no stylesheet for a mithril page, the string "undefined" would end up being injected.
- More aggressive error checking during wizAssetsHandler downloads.


## v0.6.6

The app.firewall function used to receive a single parameter that was the net.Socket object. It has now been augmented with
a 2nd, transport specific, parameter. The only transport we currently have is the HTTP server, so this argument will always
be a ServerRequest object from Node.js's http module: http://nodejs.org/docs/latest/api/http.html#http_class_http_serverrequest


## v0.6.5

### Messages to all players

The msg module now supports sending to all players by providing a "null" receiver when sending.
NOTE: The MySQL schema has changed to make this possible. Please refer to db/changes.sql. The API is backwards compatible.

### wizAssetsHandler power-up

The wizAssetsHandler has become much more powerful. It now chunks up all files-to-download into several phases. Each phase can be
configured with 2 settings:
- maxCacheability
- parallel

maxCacheability is a number that indicates up to (inclusive) which cache level (this is configured per asset in the asset map)
files need to be downloaded. Files that have a negative cache level are never downloaded. Files with a cache level too high to
match maxCacheability of this particular phase are skipped and possibly downloaded in a next phase. Files are never downloaded
more than once, so two phases can overlap safely. The default maxCacheability is Infinity, so every asset (except negative) will
match.

The parallel parameter is used to indicate to the downloader how many files to download in parallel. The default is 1, meaning
sequential only.

The system is fully backwards compatible, because it comes preconfigured with one phase: "main", which has a maxCacheability of
Infinity and parallel value of 2. You can change this phase or add a new phase by calling:

```javascript
var phaseName = 'main'; // or your own name of choice to create a new phase

myAssetHandler.setup(phaseName, { maxCacheability: 0, parallel: 5 });
```

The typical use case is tag critical assets as cacheability 0, meaning "must have". Once these are downloaded, the next phase
could do background downloads with a parallelism of 1 (sequential downloads) in order to decrease the effect on the connection.
This use case has been tested to work well. The asset system will start using the local URL from the moment the asset has been
downloaded, even if the player has been inside of the game for a long time.

The progress per phase can be followed through the events "phaseStart" and "phaseComplete" which both receive as their first
parameter the name of the phase, and as a second parameter an array of assets that will be downloaded, or in the case of
"phaseComplete" have been downloaded (but keep in mind that this array contains both successful and failed downloads).
All other events are unchanged.


## v0.6.4

### Actor language improvements

Before, an actor's language was (wrongfully) stored on the player record. Sessions depended on this, so that meant that content
managers needed a player record in order to have a session. This has been resolved and language is now an optional property on
the actor's livePropertyMap, and it defaults to EN. Incidentally, this also has the following positive side effects:
- session registration now no longer requires a MySQL query, but instead pulls the language out of Membase.
- emitting events to other players should now be dramatically faster.

A small BC break is that player.getLanguages() no longer exists, but nobody (except Mithril itself) was using that anyway.

### Tool changes

Gm rights changed from an array to an object. Example:

```json
{
	"actor": {
		"viewable": false
	},
	"giraffe": {
		"viewable": true
	},
	"game": {
		"viewable": true
	}
}
```

## v0.6.3

### BC break:

A command center is now created on each app automatically. To access it, just talk to yourApp.commandCenter(.expose() etc). This means
that you now have to make sure you create the app before talking to its command center. Before they were more separated and some games
had reverse logic: create a command center and then later instantiate the app. It also means you can no longer call
mithril.addCommandCenter(), since the command center automatically exists.

### "Firewall" option

It is now possible to register a firewall function on your app. The function receives 1 argument, which is the connection object of
type net.Socket, as described here: http://nodejs.org/docs/latest/api/net.html#net.Socket
The function's return value will be evaluated and if falsy, the connection is not accepted. This applies to both the command center
and the page serving. A typical example:

```javascript
myApp.firewall = function (conn) {
	return myAllowedIpAddresses.indexOf(conn.remoteAddress) !== -1;
};
```


## v0.6.1, v0.6.2

### BC break:

Database changes have been made to the gm and gm_data tables. Please run the last ALTER statements in db/changes.sql.
The Makefile in Mithril now has a lot of cool commands. Run "make help" in the Mithril root path to see what it can do!

### Batched user command execution

The command system now allows for batched execution of any amount of user commands. The way to execute multiple commands in a single
request is by calling the functions in a non-asynchronous way. This has been implemented in Mithril's setup process, causing all sync
commands to bundle up into a single call. While a request is in progress, no other command may be queued, and a "busy" error will still
occur, as it has before. The only typical cause for this "busy" error is now user interaction though, so it should still make fast
double-taps fail.

On the server side, the cache TTL can be configured per command center (ie: per application). This cache used to let you run into
trouble when re-using an existing session, by responding with an old response for a new command execution (reported by Thibaut).
That problem should no longer occur.

Advantages:
- A single round trip, instead of a slow sequential string of user commands.
- No more "busy" errors you need to code around.
- Only a single cached response (gzipped when possible) to aid unreliable network connections.
- The server only has to verify credentials (session, giraffe hash) once, for all bundled commands at once.
- Potential (though not yet implemented) for parallel execution on the server for read-only commands (such as sync).
- Compressed responses when the content is large enough (currently only in the Node-0.6 branch). This has shown a huge gain.

### Giraffe

Push notifications can now be sent in batch using pushNotifications(messages, options). This function receives no state or callback
since it's a full background operation (and generally quite slow).

### Messages

- Message expiration on sync.
- Some SQL queries have been optimized to be faster.
- a new delMessages user command.
- the client function search() no longer requires an options object.

### Logger

The logger's output performance has improved dramatically (x3), by no longer relying on the slow console object, but by
writing directly to stdout/stderr streams.

Also, the logger has been completely rewritten to be more easily configurable. The new configuration looks like this:

```json
{
  "logging": {
    "theme": "default",
    "show": ["debug", "info", "error", "time"],
    "hide": ["debug"],
    "output": "terminal or file",
    "path": "/var/log/myGame"
  }
}
```

Leaving out the logging, will display all channels (debug, info, etc) without color coding. Creating config and setting the theme
to default will enable colors from the theme "default" (currently the only theme). Providing an array of channels in the "show"
property, will show only these channels. Alternatively, a "hide" array will show all channels, except the ones in the given array.
Using both "show" and "hide" makes no sense, but works. If output is "terminal", errors will go to stderr, and everything else to
stdout. In other words, they all end up on your screen. Setting output to "file" will create a file for each channel that is being
logged, in the directory specified in the "path" property.

Your old configuration will still work, but will output a deprecation warning. Please update your config files as explained above.

The refactoring of the logger module has made it so that the it could be externalized from Mithril as a separate module. We may
eventually open source this, although the question is if the community is really waiting for yet-another-logger module.

### Small changes

- SNS: When a relation is requested, a module event is emitted called "relationRequested".
- All console.log() statements in the Mithril client have been removed. Want to see network data? Open the network tab.
- The Time module now calculates server/client time delta on the server, and no longer on the client.
- The wizAssetHandler plugin handles parallel downloads now, and emits progress events sequentially.
- The NPC sync data is now cached JSON, so will be faster.
- When ZeroMQ bindings fail, Mithril now handles it more gracefully.

### Bugfixes

- Database errors were not being logged properly.
- TimedValue would not emit some events at the right time.
- On the client, updates on a special data type would overwrite the object instead of update it. (hotfix 0.6.0-1)
- Manifest creation was broken.
- The client side GREE module was not calling the callback after setup.
- LivePropertyMap's importFromStaticPropertyMap was broken when copying objects.
- The score module relied on the MySQL table game_playerstate. This has been removed.
- The logger failed when logging undefined.
- The appleAppStore receipt checking logic was failing under some circumstances. (hotfix 0.6.0-2)
- obj.getObjectActors() failed when an object was not present in any collections. (hotfix 0.6.0-3)


## v0.6.0

### Shop API change

The shop's ShopItemValidator functions used to return a map of items, with a quantity property on the item object.
`{ itemId: { id: , quantity: 1, etc... }, itemId: etc... }`

This is inherently unsafe when used with cached item definitions, which is very very easy to do (and likely what everybody is doing).
For this reason, we have changed the API to require you to return a list of items like this:
`{ itemId: { item: { id: , etc... }, quantity: 1 }, itemId: etc... }`

Please check your code and make the necessary adjustments.

### Builder

The builder now allows for nested build descriptors in your code. For example, the following is now possible:

`$dir($cfg(some.config.path))`


## v0.5.0

### BC breaks

Backwards compatibility break in obj module:
The APIs obj.getFullCollection and obj.getFullCollectionByType have now received an options object, which may contain properties for data loading.
- getFullCollectionByType(state, type, owner, options, cb)
- getFullCollection(state, collectionId, options, cb)

Options may be an object containing LivePropertyMap options, like:

```javascript
var options = {
	properties: {
		loadAll: true
	}
};
```

BC break in msg module:
The MySQL schema has changed a little bit. Please refer to db/changes.sql. The API is unchanged.

### Logger

The logger can now output execution times for user commands. If you want these output, simply add a context "time" to your logger configuration,
besides the already existing "debug", "info" and "error".

Also, the logger now has support for custom color selection. This can be configured by turning the output format, such as "stdout" or "file" into
an array of the format: `["output", "color name"]`, such as `["stdout", "yellow"]`. A list of accepted colors can be found on this website:
[node-colors](https://github.com/Marak/colors.js) under "colors and styles!".

On error, the actor ID is now always prepended to the error log output.


## v0.4.2

The client side code of Mithril has been split up a bit, in order to move some code out of the loader, and into an external page (landing).
The only change to apply is to add $html5client(modulesystem); to the landing page script. Best place to put it, is right after
$html5client(io); and $html5client(datatypes);, and before any actual modules.

Also added in this release, is cacheability. Assets can now be tagged with a number (on regFile, after language) to indicate how cacheable a file
is. The number's meaning:
-1: never cache;
0: always cache;
N (positive integer): try to cache, lower means higher priority.


## v0.4.1

### Sessions

The session module is now more configurable (optionally). The following configuration parameters have been exposed:

* `module.session.ttl` is the session's time-to-live, after having been idle. The format is human readable, eg: 60s, 3m, 1h, 1d. The default is 10m.
* `module.session.keyLength` is the session key length in number of characters. The default is 16.

### MMRP

Mithril's server-to-server messaging protocol has a configuration setting "server.mmrp.expose.host" that has now become
optional. You may still use it, to announce to the world what the host is that other servers may connect to. But by default,
Mithril will now use DNS to resolve the IP of the server it is running on.

### HTTP Server

The HTTP server now has a heartbeat configuration setting for the event stream. This means that every N seconds, even if no
events are to be sent to the browser, the server responds with a "HB" code. The client will understand this as a heartbeat and
will reconnect. This mechanism is used to keep the server clean from zombie connections.

Another change in configuration is that the protocol setting has been moved from the "expose" structure, into the main
"clientHost" configuration. An example for the full configuration:

```json
{
	"clientHost": {
		"protocol": "http",
		"transports": {
			"longpolling": { "heartbeat": 120 }
		},
		"bind": { "host": "0.0.0.0", "port": 4242 },
		"expose": { "host": "mygame.myname.dev.wizcorp.jp", "port": 4242 }
	}
}
```

## v0.4.0

### Membase / LivePropertyMap

#### Background

We are slowly but surely moving a lot of data out of MySQL, and into alternative storage systems. Membase is an incredibly fast
persistent key/value storage system, based on the memcache protocol. Considering the relatively small data sizes that individual
players deal with, we have found it valuable to move a lot of player related data into membase. The main advantage is the ease
of scaling up the server farm. MySQL is incredibly difficult to scale up into a large amount of servers, yet for membase it's a
completely transparent issue. Wizcorp has released an open source library to provide virtual memcache/membase transactions in
a module called [node-memcached-transactions](https://github.com/Wizcorp/node-memcached-transactions). Mithril uses this module
to issue writes on-commit. This means you can still do a (virtual) rollback after writing, even though membase itself does not
provide transactions. Mithril makes good use of this, and so as a developer, you should experience the same flexibility as you
were used to in the previous situation with MySQL.

#### Status

We have not (yet) refactored the entire dataset into Membase. We are currently limiting the effort to user-data only. That means
that static definitions (quests, shop contents, object classes, etc..), for now, stay in MySQL. Also, some user data found in
some modules has not yet been refactored to Membase. This should be easy enough however and will be implemented as needed by
developers in order to receive proper test coverage.

Currently refactored are user data in: actor, gc, giraffe, obj.
Not yet refactored are: gree, history, msg, persistent, player, gm, shop.

#### The LivePropertyMap class

LivePropertyMaps are the classes that are used to represent what used to be data-tables in MySQL. Whenever you write to these
objects, the data is automatically synchronized to the client. The client side representation of our modules no longer have to
take care of data-caches. Note that this automatic synching includes logic for dealing with special data types such as
TimedNumber and TimedValue. The changing of your properties on the client is exposed through events, so you can tap into
specific property changes in a very simple way.

On the server, the refactored modules now expose LivePropertyMap instances through alternative functions. Because of this, the
old data getters and setters for this data have been removed. Also, the parameter for setting properties in obj.addObject() has
been removed.

The API to create a LivePropertyMap is exposed through:

* obj.getObjectProperties(state, objectId, options, cb)
* obj.getObjectsProperties(state, objectIds, options, cb)
* obj.getClassActorProperties(state, classId, actorId, options, cb)
* obj.getClassesActorProperties(state, classIds, actorId, options, cb)
* actor.getActorProperties(state, actorId, options, cb)
* actor.getActorsProperties(state, actorIds, options, cb)
* gc.getNodeActorProperties(state, nodeId, actorId, options, cb)
* giraffe.getUserProperties(state, userId, options, cb)

The plural versions of these functions return a key/value map of LivePropertyMap instances, with a logical key that is the ID
of that which you provide as an array (classIds, actorIds, ...). For a deeper understanding of how this all works, please
inspect the code of the functions mentioned above.

The options object may contain a property `{ loadAll: true }` that will load every property from Membase. This is generally
not recommended though. Prefered is: `{ load: ['name', 'xp', 'level'] }` in order to preload specific properties. After that,
you may use `var value = myPropertyMap.get('name', 'EN')` to retrieve the value (note that this does not require a callback).
Other exposed functions are `set('name', 'Bob', 'EN');` and `myPropertyMap.del('olddata');`.

#### Advantages for developers

For all the data that sits in Membase, you no longer have to worry about querying multiple times for the same data. The
node-memcached-transactions module has been made to be 100% efficient in data-reuse. That means for example that requesting the
same key twice (or more), will only result in a single read. Also, if you write a value to a key, and some time later your code
ends up doing a read, it will simply yield the previously written value.

The transactional model allows for write operations to be queued, instead of executed. This means: synchronous behavior (ie:
no callback spaghetti). Reads obviously are still asynchronous.

You can create your own property maps very easily wherever it makes sense. This generally costs you less than 10 lines of code,
and because Membase is schemaless, you won't have to set up any tables.

#### Disadvantages for developers

Because of the nature of key/value data stores, you will no longer be able to do table-scans for data. If you want a value, you
will have to know the key that is associated with it. That is not always possible, and workarounds must be implemented for
these cases. This seems like a real pain, but ends up giving us ultimate performance, and is a sacrifice on a very limited
code base that we have to be willing to make. In the future, we will have proper APIs to deal with these cases however, so any
frustration that may exist today, will eventually be taken care of.

### More EventEmitter instances

More and more objects on the client side are becoming EventEmitter instances. This means that they can emit events. Expect in
the future that modules will emit their own events whenever data changes, instead of having to go through mithril.io.

### Time module

A new module called "time" has been introduced to deal with automatic time synchronization between server and client. That means
that on the client side, every bit of information that is time-based is now supposed to normalize against the client time. This
has been implemented for TimedValue/TimedNumber, so even if the client and server disagree about the time by 10 minutes, the
time on the client will display synchronized to the client's own clock. To use this module:

* server side, be sure to useModule('time')
* expose its "sync" user command on your command center.
* on the client side, make sure your build includes this module.

### Smaller changes

* The gree module's shop integration no longer responds with a request to do an HTTP navigation. Instead, a "gree.redirect" event is emitted.
* The shop module now caches all static data. Before, it used to always hit the database to read this data that never changed.
* The giraffe module now stores user data on its own live property map, and no longer on actor data.
* Reliability improvements on the client's IO module, command center and event stream.
* Because Membase stores objects as JSON serialized objects, a module's sync command will no longer parse this data, but instead use the data as is.


## v0.3.2

### User commands

Modules' client code are now generated by the HTML5 client builder process. This includes functions for all user commands, that are now automatically injected.
Of course this is limited to exposed user commands. The requirements (hooks) are also part of the generated code, so developers no longer have to worry about this.
This does mean the API/build-process for writing modules has changed a little.

On the server, we now have to add one line of code per user command:

```javascript
exports.params = ['each', 'parameter', 'name'];
```

Which is now also reflected in the execute function:

```javascript
exports.execute = function (state, each, parameter, name, cb) { ... };
```

On the client, this:

```javascript
var mod = {}
window.mithril.registerModule('myModule', mod);
```

Has changed into:

```javascript
var mod = mithril.registerModule($html5client('module.myModule.construct'));
```

The module will now automatically have a function wrapper for each exposes user command.

### Mithril client builder

The datatypes libraries are now externalized and have been moved out of `$html5client(core)` and into its own `$html5client(datatypes)`,
so please add this to one of your page scripts, preferably right before `$html5client(io)`.

### Starting up the mithril client

What used to be `mithril.setup(config);` has been renamed to `mithril.configure(config);`.
Also, `mithril.start(myCallback);` is now `mithril.setup(myCallback);`, which may be called any amount of times.
The mithril.setup API sets up any not-yet-set-up modules. So every time you add a bunch of modules (usually a chunk of them per page),
you'll want to call mithril.setup.

### The loader

The loader's setup parameters have changed. It no longer requires the baseUrl, language and appName parameters, so you have to remove them.
Only the pages array remains.

```javascript
window.mithril.loader.setup(pages);
```


## v0.3.1

Asset maps are now on a per-application basis.

```javascript
// creating an asset map:

var assets = mithril.assets.createAssetMap();

// creating helper functions to register files:

assets.regImg   = assets.regFile.bind(assets, 'img');
assets.regFont  = assets.regFile.bind(assets, 'font');
assets.regAudio = assets.regFile.bind(assets, 'audio');
assets.regHtml  = assets.regFile.bind(assets, 'html');

// adding the asset map to an app's page:

myApp.addPage('myPage', '../../www/pages/myPage', { assetMap: assets });
```

## v0.3.0

Version 0.3.0 adds a new build system. It is extremely flexible and customizable.

### Changes:

* When serverCache is enabled, all build targets are built before the HTTP server is opened up. This prevents users from hammering the server when it's not ready yet.
* The builder is really a framework that allows for many different builders to cooperate. These builders share knowledge on contexts, parsers and post processors.
* Since less and uglify are now supposed to be provided by the game developer, Mithril no longer has these dependencies. You will have to add these to your game's package.json file.
* The "mithrilui" module has been completely replaced.

#### Inline build targets

Inline build targets are formatted as: $builder.context(key)
This may optionally be followed by a semicolon. Also, the key may be surrounded by single or double quotes.

### New concepts:

#### Builders

Builders are libraries that build files and data.

Mithril comes with a number of builders pre-installed:

* file (reading from a file path)
* dir (reads from a directory)
* path (reads a file or a directory)
* pathlist (reads from a list of files and/or directories)
* filecontent (builds the contents of a file)
* web (builds Mithril pages and manifest files)
* html5client (builds the Mithril client for HTML5)
* cfg (outputs configuration values)

#### Contexts

Builders can implement support for various contexts. Contexts may have associated file extensions and mimetypes.
Pre-installed contexts are:

* html (.html, .htm: text/html; charset=utf8)
* css (.css: text/css; charset=utf8)
* js (.js: text/javascript; charset=utf8)
* manifest (text/cache-manifest; charset=utf8)
* mithrilpage (text/mithrilpage; charset=utf8)
* url (eg: $web.url(manifest) will output the URL to a generated manifest file)

#### Parsers

Based on a file extension, they can parse a file and turn them into a known format, to be embedded into other files.
Current use case: less (to turn .less files into css).
Game developers are excpeted to register these themselves.

#### Post processors

These further process a built target. Current use cases: css and javascript minification.
Game developers are excpeted to register these themselves.

### Examples:

#### Adding an extension and associated parser

```javascript
mithril.core.app.contexts.get('css').addFileExtensions(['less'], function (filePath, data, cb) {
	var path = require('path');

	var fileDir = path.dirname(filePath);
	var fileName = path.basename(filePath);

	var less = require('less');
	var options = { paths: [fileDir], filename: fileName };

	try {
		var parser = new less.Parser(options);
		parser.parse(data, function (error, tree) {
			if (error) {
				mithril.core.logger.error(error);
				return cb(error);
			}

			cb(null, tree.toCSS());
		});
	} catch (error) {
		mithril.core.logger.error(error);
		cb(error);
	}
});
```

### Adding a post processor

```javascript
mithril.core.app.contexts.get('js').addPostProcessor('minify', function (data, cb) {
	mithril.core.logger.debug('Minifying JS contents through "uglify".');

	var uglify = require('uglify-js');

	try {
		var ast = uglify.parser.parse(data);
		ast = uglify.uglify.ast_mangle(ast);
		ast = uglify.uglify.ast_squeeze(ast);
		data = uglify.uglify.gen_code(ast);

		cb(null, data);
	} catch (error) {
		mithril.core.logger.error('Error while minifying:', error);
		cb(error);
	}
});
```

### Setting up pages

```javascript
var WebApp = mithril.core.app.web.WebApp;

var gameApp = new WebApp('game', { languages: ['EN'] });
gameApp.setIndexPage('../../www/pages/loader');
gameApp.addPage('landing', '../../www/pages/landing', { assetmap: true });
gameApp.addPage('main', '../../www/pages/main');

var manifest = gameApp.createManifest();
manifest.add('mui://img/ui/spinner');
```

### Configuration options

The "mithrilui" entry has to be completely removed. Renamed the "app" entry to "apps", and make it similar to the following:

```json
{
	"apps": {
		"game": {
			"name": "My awesome game",
			"url": {
				"public": "http://myawesomegame.com"
			},
			"delivery": {
				"serverCache": true,
				"useManifest": false,
				"compress": true,
				"postprocessors": {
					"css": "minify",
					"js": "minify"
				}
			}
		}
	}
}
```

Some notes:

* If you set up a manifest, but do not set useManifest to true, it will not be exposed to the HTTP server.
* serverCache is built at Mithril startup. During development, it makes a lot of sense to keep this set to false.
* compress means gzip compression of the output.
* Any amount of postprocessors may be registered by developers. The configuration decides which are actually applied.
* postprocessors may be arrays, in order to apply multiples. Eg: "css": ["tidy", "minify"]


## v0.2.0

Version 0.2.0 adds some long awaited features.

* Multi-server support (with zeroconf auto-discovery).
* Multi-node support (using LearnBoost's cluster library, in the future we'll switch to NodeJS 0.6's cluster).
* A new messaging system between users and servers (based on zeroconf).
* A new browser to server communication system (no more Socket.IO).
* Improved per-user-command hook system (will allow for unauthorized user commands).
* Improved build system that now allows for $tags(even.in.embedded.files).
* Integration with Memcached/Membase. Currently applied only to session management.
* Improved error handling and IO events.
* Magic data types (in particular: timed values/numbers).

Some smaller new changes:

* Colorized logging.
* Wizcorp's open sourced LocalCache library.
* Games can be started from any directory, the cwd is automatically adjusted.
* Fix: the logger did not write to file.
* Ability to retry a user command. Responses are cached on the server, so a retry will correctly yield the previous response.
* Custom server-side modules can be referred to with a relative path (eg: "./modules/quest").

BC breaks:

* The current working directory is now the path of the first JS-file, so the reference to the config file will most likely have to be adjusted.
* Command centers (multi) are now created per package.
* Client: mithril options now can contain an IO timeout value and defaultHooks.
* Client: the Giraffe module has been refactored.


# Release history

## vNEXT

### Peer Dependencies

Are you sitting down? This is a massive **breaking change**, with a simple solution. A while ago we
released an NPM module called [codependency](https://www.npmjs.org/package/codependency). Read about
it on Tumblr: [Node.js peer dependencies done right](http://wizcorp.tumblr.com/post/74368547644/).

This MAGE release adds the codependency system to MAGE. All the dependencies that MAGE used to
contain which are used as "engines" for archivist, logging, service discovery, authentication and
messaging are now **gone**. They are no longer built into MAGE. Instead, it's up to you to add these
dependencies to your project.

### What does this mean for you exactly?

* Smaller and faster installations (and thus faster CI and deployment as well).
* A bit more work for you, because now you manage which packages (and versions) you install.
* MAGE enforces semver version ranges of these packages, so compatibility is still guaranteed by MAGE.

### How do you know which version of a library to use?

You can see the list of supported packages in `./node_modules/mage/package.json` in the
"optionalPeerDependencies" entry. If you get the version wrong, MAGE will tell you exactly what to
install instead.

### So which packages are we talking about exactly?

To save you one trip to `./node_modules/mage/package.json`, here's the list:

```json
{
	"optionalPeerDependencies": {
		"loggly": "0.3.11",
		"graylog2": "0.1.2",
		"mysql": "2.0.0-alpha9",
		"couchbase": "1.2.0",
		"memcached": "0.2.6",
		"redis": "0.9.0",
		"manta": "1.0.1",
		"memorystream": "0.2.0",
		"aws-sdk": "1.15.0",
		"es": "0.3.12",
		"node-zookeeper-client": "0.2.0",
		"mdns2": "2.1.4",
		"zmq": "2.5.1",
		"ldapjs": "0.6.3"
	}
}
```

If you need any of these (which is incredibly likely), please add them to your `package.json`'s
`dependencies` list using a version compatible to what you see above.


## v0.33.1 - Heli Fail Cat

### Builds now use first route

v0.33.0 broke the dashboard. Reverted changes to the path used for dashboard component registration.
Now builds use the route they will be served at instead of a path from the machine they were built on.

## v0.33.0 - Long Cat

### Archivist Fixes

Archivist was not properly communicating with the client that a value did not exist, this has been
corrected.

### Asset indexing

MAGE now keeps a .digest-cache.json file in your assets folders to speed up asset indexing.
Additionally, you can now have MAGE index your assets whenever you want by running:
```bash
node . assets-index
```

### Internet Explorer 9 support

MAGE now supports Internet Explorer 9! Charset is now properly set to 'UTF-8' and javascript is
now added to script tags using textContent instead of innerHTML.

### Long running requests

MAGE will now log a warning if any http request takes longer than 500ms to complete, but only if
you're using node v0.10+

### Graylog2 Fix

Graylog will no longer cause an uncaught exception when a DNS lookup fails. However, it will only
console.error if errors do occur.

### MDNS Fix

MAGE was logging errors at an alert level when dns failed to resolve hostnames from other games. It
will now log them at a verbose level.

### Dependency updates

| dependency        | from   | to     | changes   |
|-------------------|--------|--------|-----------|
| node-graylog2     | 0.1.1  | 0.1.2  | [Release notes](https://github.com/Wizcorp/node-graylog2/releases) |
| mdns2             | 2.1.1  | 2.1.4  | [Change log](https://github.com/Wizcorp/node_mdns/blob/master/CHANGES) |

### Couchbase Migrations

Added Couchbase migration functions, allowing the user to create migration scripts for couchbase
typed vaults. Though this may be the case, these should only be used to create couchbase views and
"NOT" migrate player data itself.

### Bug fixes

MsgStream will now get it's url configured in builds.

### Miscellaneous changes

* Build -f has been removed. If you don't want to build, don't build.
* Disable the console override by setting disableOverride to true in logging.html5 instead of setting
disableOverride to true in both logging.html5.console and logging.html5.server. Your config will
need to be updated to continue disabling console overrides.
* the MAGE dashboard loader now uses a relative path.

## v0.32.0 - Please Work Cat

### Logger

#### Simpler configuration

The logger configuration now accepts channel range strings (eg: `>=debug`), as well as the
previously supported arrays of range strings (eg: `["debug", "info"]`). That means that you may
reduce an array of channels down to a string in your configuration file.

#### Custom log files

The default behavior of the file logger has always been to log each channel to its own file (eg:
`error.log`, `alert.log`). That default has been changed to always log everything to a single file
called `app.log`. You can now also configure the file logger to write any channel to any file
name. It also means that you can log a channel to multiple files in parallel. This is an example
configuration to illustrate how this could benefit you:

```yaml
logging:
    server:
        file:
            channels: [">=debug"]
            config:
                path: "./logs"
                mode: "666"
                fileNames:
                    "app.log": []   # this lets you turn off or redefine what gets logged to app.log
                    "dev.log": "all"
                    "access.log": "info"
                    "error.log": ">=warning"
```

#### File modes

When configuring the file logger with a file mode, the creation of a log file would follow this file
mode. Once created however, the file's mode would never change, even when your configuration did.
This has been resolved by always updating the file mode when it's opened.

### Command Center and Message Stream revisited

The command center and the message stream subsystems have been dramatically refactored. This cleans
up quite a bit of internal spaghetti, and paves the way for further architectural improvement. With
this refactoring a number of things have changed for the better.

* Gzip compression now is always on (you can remove it from your configuration).
* Web clients that do not support gzip will be served an unzipped version automatically.
* If MMRP (the server-to-server event system) is not configured, the MAGE client will no longer set
  up a message stream. **WARNING**: If you are using `mage.msgServer.stream.[abort/start]`, please
  make sure you first test if `stream` is actually there. Turning off mmrp will no longer expose
  `stream`.
* When a non-existing URL is received in an HTTP request, it no longer logs an error that a user
  command could not be found. Instead it becomes a normal 404.
* All HTTP 404 responses are now logged at the "warning" level.
* Less use of the async library in command center, which means cleaner stack traces.

### Component

We now start up a small http server that proxies requests to install components. This means we can
install components from private repositories on github!

### Dependency updates

| dependency        | from   | to     | changes   |
|-------------------|--------|--------|-----------|
| jshint            | 2.4.1  | 2.4.3  | [Release notes](https://github.com/jshint/jshint/releases) |

### Small improvements

* The `io.error.busy` event that the message server in the browser could emit has been augmented to
  show which command could not be executed, and which batch was blocking it. It also carried a
  `behavior` property, which has had no meaning since forever, and has therefore been removed.
* Development mode has become more configurable. Please read
  [the documentation](./docs/walkthrough/Configuration.md) for information on how to use it.
* The client logger used to send a `client` property with the value `html5` with every report, which
  was absolutely useless as there is no other value for it, so it's been removed.
* The builder will now only JSON.stringify $cfg injection if the context is js.

### Bugfixes

* When not running in cluster mode, depending on your environment, Savvy would not be available.
* You can now disable a logger by setting it to a falsy value (ie. null, false, 0).


## v0.31.0 - Skateboard Cat

### Archivist: File vault

FileVault will no longer return data from files that are expired and will actively delete the files
if their expiration time has come and gone. Previously, if MAGE started up and the file had not
expired yet, fileVault would continue returning data from it until MAGE restarted. Also, fileVault
will no longer delete files before setting them unless the file extension changes.

### Time module

The time module has received a server implementation where none existed before. This **deprecates**
the use of `mage.core.time`. From now on, please use `mage.time.now()` instead. This function works
on the server side as well as on the client side. A simple find and replace should allow for a
seemless migration.

One of the reasons for this transition is a future update to the time module which will make it
possible to shift the offset and accelerate and decelerate the clock.

For more information on the time API, please read [the documentation](./lib/modules/time/Readme.md).

### Dependency updates

| dependency        | from   | to     | changes   |
|-------------------|--------|--------|-----------|
| highlight.js      | 7.5.0  | 8.0.0  | [History](https://github.com/isagalaev/highlight.js/blob/8.0/CHANGES.md) |
| marked            | 0.2.10 | 0.3.0  | [Commit log](https://github.com/chjj/marked/compare/v0.2.10...v0.3.0) |
| jshint            | 2.3.0  | 2.4.1  | [Release notes](https://github.com/jshint/jshint/releases) |
| mocha             | 1.15.1 | 1.17.0 | [History](https://github.com/visionmedia/mocha/blob/1.17.0/History.md) |
| istanbul          | 0.1.46 | 0.2.1  | [History](https://github.com/gotwarlost/istanbul/blob/v0.2.1/CHANGELOG.md) |

### Small improvements

* We now display the logged in user's name on the home screen in the dashboard.
* When problems arise during archivist client's distribute phase, the issues returned in the 2nd
  argument of the `distribute` callback is now of the format `{ topic, index, operation, error }`.
* The long since deprecated `pauser` module has been removed from MAGE. Instead, please use the
  [Locks component](https://github.com/Wizcorp/locks).
* The `oauth` dependency was not being used anymore and has been removed.

### Bugfixes

* When the archivist client was distributing changes back to the server, it could crash the process
  if a topic did not exist, or something else went wrong during a set/add/del/touch operation.
* If cluster communication is never established (mdns / zookeeper), MMRP messages would pile up,
  leaking memory.
* When calling `mage.useModules()` on the server giving an already registered module, it would re-
  register it (without problematic consequences).


## v0.30.0 - The Persistence of Memory Cat

### Builder speedup

#### Bugfix

Since the new and improved builder from MAGE v0.25.2, which significantly improved build times, a
bug was introduced that created an `O(n^2)` situation. Given enough pages to build, the list of
components to not include in a page (because of its existence in a previous page) would blow out of
proportion. An exponentional problem like this can quickly turn a problem of size 10 to size a
million gazillion.

The cause has been tracked down and the issue has been resolved. This should not have an affect on
the produced build, but the time it takes to create it should have been reduced (and you will
experience this more as your project contains more pages).

#### Aliases

The way we have been avoiding the over-production of aliases, was by removing duplicates from our
builds after they were generated. In some projects, that could mean that we were scanning through
megabytes of aliases in order to throw many of them away. We now hacked around the megabytes, by
overriding how component-builder generates the aliases to begin with. When we detect duplication,
we bail out. This way, a lot less work needs to be done, and in one project the build-time has
been reduced roughly 10-fold.

### Memory usage tracking

Messages sent over the wire through **ZeroMQ** are now tracked by sampler (size and count). Besides
that, this release also introduces two new dependencies which will help us in tracking down memory
leaks.

**node-memwatch**

Created by Mozilla, [memwatch](https://npmjs.org/package/memwatch) emits events after garbage
collection cycles, and reports how much memory V8 is consuming. This information is now shared with
sampler, so that we can start graphing it in production. When we notice that memory usage is growing
or getting out of hand, we can use the next library to analyse the situation.

**node-heapdump**

Created by Strongloop, [heapdump](https://npmjs.org/package/heapdump) can make a full JavaScript
memory dump to disk, in the folder of your project. This is a very expensive job (as more memory
is being used up), so use this with care. It should not freeze your game too much, as the dump
happens in a forked process.

The memory dump created by heapdump can be imported into Google Chrome, which can display it just
like you would normally do when making a memory dump in the browser. The dump can be created by
sending `SIGUSR2` to a worker process. You can do this by running

```bash
kill -USR2 workerpid
```

Where you replace "workerpid" with the PID of your worker process. Please note that the master
process does not support this, although that may change in the future.

For more information on how to use heapdump, please read the Strongloop
[blog post](http://strongloop.com/strongblog/how-to-heap-snapshots/).

### Small improvements

* The daemonizer no longer uses `SIGCONT` to test if a process is running, but instead signal 0,
  which is universally recommended for this exact purpose.
* On the client side, the asset module now exposes the `Asset` class, so a developer can use that to
  augment the asset map on-the-fly (thanks Brian!).


## v0.29.0 - Cloud Cat

### Archivist

#### Updated DynamoDB vault

Updated DynamoDB vault to use latest aws-sdk. If no report is provided by a migration, it will now
default to empty object.

### Dependency updates

| dependency        | from   | to     | changes   |
|-------------------|--------|--------|-----------|
| aws-sdk           | 1.8.1  | 1.15.0 | [Release notes](http://aws.amazon.com/releasenotes/SDK/JavaScript/1497711678189204) |


## v0.28.0 - Viking Cat

### The ident module

The ident module has undergone some radical changes. What you need to know is mostly limited to
configuration however. In a nutshell, the `apps` layer in the `module.ident` configuration has been
removed and replaced by `engines`. In there, you configure the various user identification engines
you want to set up. The `anonymous` engine is always built-in, so you don't need to configure that
anymore. Any app can use any engine simply by referring to its name.

Please refer to the [ident documentation](./lib/modules/ident/Readme.md) for more information on how
to use it.

### Archivist

#### Replace existing Tomes on the client

You can now replace Tomes that already exist on the client by calling `del` before calling `set`.
This will cause Archivist to send a whole new Tome to the client and call `Tome.destroy` on the
existing Tome.

### Small improvements

* The documentation indexer (the slowest of the user commands on the built-in dashboards) has been
  sped up by a factor of roughly 2 (potentially more on big projects).


## v0.27.0 - Christmas Cat

### Archivist

#### A new Couchbase vault

A while ago the [couchbase](https://npmjs.org/package/couchbase) npm module was radically refactored
and improved. This paved the way for it to become production ready. We have therefore upgraded the
Couchbase vault to use this new version. This should improve performance over `node-memcached`. It
also adds sharding, making it possible to bundle a user's data in the same physical space.

#### File vault creation

You can now run `./game archivist-create` and `archivist-drop` to create and destroy a file vault.
That means that an empty file vault no longer needs to be comitted into a repository with a
placeholder file. Simply running `make all` will set it up for you.

#### archivist-create & archivist-drop

You can now specify which vaults you want to create or drop using the cli. If you do not specify
any vaults, archivist will create or drop all vaults. Vault names must be comma separated with no
spaces.

```bash
node . archivist-create mysql,testVault
```

### Config

MAGE can now handle applying multiple configs specified in your NODE_ENV environment variable. This
should be comma separated with no spaces. Configs will be applied in order from left to right. The
main motivation for this change is allow developers to override user configs for unit testing.

```bash
@NODE_ENV=$NODE_ENV,unit-test node ./test
```

### Dependency updates

| dependency        | from   | to     | changes   |
|-------------------|--------|--------|-----------|
| couchbase         | 0.0.12 | 1.2.0  | [Release notes](https://github.com/couchbase/couchnode/releases) |
| rumplestiltskin   | 0.0.5  | 0.0.6  | [Commit log](https://github.com/Wizcorp/node-rumplestiltskin/compare/0.0.5...0.0.6) |
| commander         | 2.0.0  | 2.1.0  | [History](https://github.com/visionmedia/commander.js/blob/master/History.md) |
| highlight.js      | 7.4.0  | 7.5.0  | [History](https://github.com/isagalaev/highlight.js/blob/master/CHANGES.md) |
| marked            | 0.2.9  | 0.2.10 | [Commit log](https://github.com/chjj/marked/compare/v0.2.9...v0.2.10) |
| mocha             | 0.13.0 | 0.15.1 | [History](https://github.com/visionmedia/mocha/blob/1.15.1/History.md) |
| istanbul          | 0.1.44 | 0.1.46 | [History](https://github.com/gotwarlost/istanbul/blob/master/CHANGELOG.md) |

### Small improvements

* The syntax highligher we use in our Markdown rendering was not recognising `js` and `sh` (unlike
  GitHub). We now circumvent this problem by renaming them before highlighting.
* The dashboard no longer uses locks to prevent you from switching between views.
* You may now safely use tomes as topics and indexes when using the archivist APIs.

### Bugfixes

* Archivist now sends the full document to the client when it didn't exist before instead of diffs.
* The MySQL vault no longer throws an error when dropping databases that don't exist.
* The documentation dashboard would stop working when encountering a symlink that didn't point to
  an actual file.
* The assets module now resolves paths starting from the game's root directory instead of the
  directory of the process that required mage.
* When the `cronClient` module is used without being configured, it will now return a friendly error
  (thanks Brian!).


## v0.26.1 - Not amused Cat

The logger client uses a dependency called
[stacktrace.js](https://github.com/stacktracejs/stacktrace.js/) to parse stack traces and make them
consistent and resolvable to source maps. The repository got moved, and since `component` depends
on GitHub URLs and doesn't follow redirects
([an issue has been created](https://github.com/component/component/issues/447)), it was breaking
installations. We now point the dependency at its new location.


## v0.26.0 - White Mage Cat

### ClientHost Expose URL

The `expose` configuration is now officially optional. For many production environments however it
is still advisable to configure. PhoneGap in particular depends on it, because its loader page (the
initial HTML file) is hosted on the device itself, so the domain from which you host your game
cannot be guessed.

The `clientHost.getClientHostBaseUrl()` method can now take an HTTP headers object and create a URL
based on those, for cases where there is an incoming HTTP request and configuration is not
available.

### Savvy

Savvy no longer takes any configuration. It now always binds to `savvy.sock` and the workers proxy
incoming savvy requests to that socket. That means that savvy now always runs off the same host and
port as the application itself, avoiding cross origin problems and keeping the infrastructure
simple and contained.

### Phantom loader

The Phantom Loader has been updated to have the following usage:

```
PhantomJS loader for MAGE app: game

Usage: ./load.sh <options>

Where <options> is:
  --help         Prints this information
  --url <URL>    A full URL to run with PhantomJS (default: http://localhost)
  --path <PATH>  A path at the given URL (optional, default: /app/game)
```

### XML support

We now support xml files in our web builder. Additionally, you can pass a specific context to index
pages if you want something besides html.

For example:

```javascript
apps.gadget.addIndexPage('gadget', './www/gadget/', { context: 'xml' });
```

Will now serve the xml files from www/gadget when receiving requests for app/gadget

### Small improvements

* There are browsers that passed the ErrorEvent object as the first argument to `window.onerror`
  while not setting it on `window.event`. We were not catching that case, and that has been fixed.

### Bugfixes

* The `archivist.list` method was not functioning since v0.22.0 (apparently nobody has used this API
  recently?). Han was nice enough to find it and fix it (massive thanks!).
* When command center client was unable to connect to its endpoint, it would fail and keep the
  client marked as busy, preventing other requests from going through. This was hurting the correct
  operation of Shokoti.


## v0.25.3 - Punchy Cat

### Cache Puncher

We have created and open sourced a little component called
[cachepuncher](https://github.com/Wizcorp/cachepuncher). Its purpose is to generate always unique
strings that can be used to fool the browser cache into thinking every HTTP request it makes is
unique. This will stop even the most aggressive browser caches from ruining your day.

The component has been integrated in these three places:

1. The page loader (since it has its own hash-based caching mechanism).
2. The command center.
3. The asynchronous event message stream.

### Alias killer

Our game builds are generated by [component-builder](https://github.com/component/builder.js) with a
thin Mage sauce around it. One of the open bugs on component-builder is an
[issue](https://github.com/component/builder.js/issues/117) where way too many aliases for
components are being registered, causing incredible bloat in the generated build. Because of our
Mage sauce around the builder, we are able to correct some of this and remove duplicate aliases from
the builds that component-builder gives us.

In this Mage release, we have done just that. The result on one Wizcorp game was that the entire
game client code shrank (uncompressed) from `3.1 MB` to `2.2 MB`. That's around 30% saved! The
number of `require.alias` calls was reduced from `14392` to `2065`.

The effects of this are as follows:

1. The Mage loader stores the smaller downloads in localStorage (generally consumes 2 bytes per
   character), so we should have faster caching and will be less likely to hit the storage quota.
2. Less `require.alias` calls means better performance during startup.
3. Less memory should be consumed by the script.
4. Download speed is not affected too much, as gzip was taking care of compressing duplication.


## v0.25.2 - Gimme! Cat

### Component builder speedup and source map support

#### Speed boost

The build process for components is now much more elegant and smart, yielding a pretty much **2x**
performance boost across the board.

#### Source maps

But the real news is that we now support source maps. We have released version v0.3.0 of
[component-uglifyjs](https://npmjs.org/package/component-uglifyjs) which you are probably already
using a previous version of in your games. This new version supports source maps, and you can enable
it by adding an option to the plugin registration:

```js
builder.use(uglify.withOptions({ mangle: true, outSourceMap: true }));
```

Just adding that `outSourceMap` boolean will make this work, and whenever you receive a stack trace
on an error from a minified source on a browser (see also: "Caveats"), the stack will be unwrapped
for you into readable symbols, files, line number and horizontal position. So **don't forget** to
update your version of `component-uglifyjs` and make your stack traces more awesome today.

#### Caveats

Before jumping in the air in pure bliss, there are a few things you must be aware of.

1. Only few browsers support error objects at the window `error` event. That means that uncaught
   errors, while logged, often do not carry an error object and therefore not a stack trace either.
   Best results so far have been achieved with Chrome.
2. Not every browser supports SourceURL, which we need in order to identify which file a frame in
   the stack trace originated in. See also
   [Mozilla bugtracker](https://bugzilla.mozilla.org/show_bug.cgi?id=583083)

### Dependency updates

| dependency        | from         | to           | changes   |
|-------------------|--------------|--------------|-----------|
| component         | 0.17.2       | 0.18.0       | [History](https://github.com/component/component/blob/0.18.0/History.md) |
| component-builder | 0.9.0        | 0.10.0       | [History](https://github.com/component/builder.js/blob/0.10.0/History.md) |
| tomes             | 0.0.17       | 0.0.18       | [Commit log](https://github.com/Wizcorp/node-tomes/commits/0.0.18) |

### Minor improvements

* The channel reference in the logger documentation has been restructured to be more readable.
* The filevault has been made a little bit more robust against race conditions. More work in this
  area is expected.

### Bugfixes

* A bug in the message server client could cause user commands to be in each other's way while
  in free mode, as is the case on the dashboard (since v0.25.0).
* If `make build` failed, it would likely not display an error.
* If `make deps-component` failed, it would still terminate with a 0 exit code.
* If mage would fail during setup, it would still terminate with a 0 exit code (since v0.24.0).


## v0.25.1 - I Can Handle This cat

### Event emission and sharding

Sharding on the client vault was usually done in one of these three patterns, as defined in a game's
`/lib/archivist/index.js` file:

```js
// pattern 1: only playerId may read this, changes will be sent in realtime

exports.inventory = {
	index: ['playerId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.playerId;
			}
		}
	}
};

// pattern 2: two friends may read this, changes will be sent to both in realtime

exports.friendship = {
	index: ['playerA', 'playerB'],
	vaults: {
		client: {
			shard: function (value) {
				return [value.index.playerA, value.index.playerB];
			}
		}
	}
};

// pattern 3: everybody may read this, but changes won't be broadcast to anyone

exports.cardDefinitions = {
	index: [],
	vaults: {
		client: {
			shard: function () {
				return true;
			}
		}
	}
};
```

The only way to allow someone else to read your document, was to give up the ability to receive
realtime change propagation. This has been resolved by augmenting the shard format as follows:

```js
// pattern 4: everybody may read this, changes will only be sent to playerId in realtime

exports.inventory = {
	index: ['playerId'],
	vaults: {
		client: {
			shard: function (value) {
				return [value.index.playerId, true];
			}
		}
	}
};
```

### Archivist client

Due to the way archivist work, when the developer would not set read options on a topic you could get
a weird situation where writing a value using the `json` media-type would be converted to a `tome`
media type on next read on the server, but not on the client. Modifying this tome would then cause
diffs to be pushed on the client side with no way to apply them (as the `json` media type doesn't
have a method to apply diffs). Trying to apply diffs to types on the client that doesn't support them
will now raise a warning in the console.

#### What to do when I get that warning?

Either make sure to `Tome.conjure` your value when storing it if it is a tome, otherwise if you don't
want that value to be "tomified" on read, setup the correct read options in your topic.

### Bugfix: Android and xhr.abort

It seems that on Android (at least 4.x) the following error happens, and this has happened on one of
our titles since they started calling `http.abort()`:

```
Uncaught InvalidStateError: Failed to read the 'status' property from 'XMLHttpRequest':
the object's state must not be OPENED.
```

The hypothesis is that `xhr.abort()` calls the readystatechange event synchronously, setting
readystate to 4. Our callback was not yet reset, causing the request completion to continue
executing and using `xhr.status`. According to w3c
[that is completely valid](http://www.w3.org/TR/XMLHttpRequest/#the-status-attribute), but this
browser doesn't like it, causing uncaught errors. This bugfix should address this race condition.


## v0.25.0 - Piggyback Cat

### Archivist

#### Sanity checks

We have made the tests that get applied when referring to a topic and index even stricter, by also
doing type checks on every single value. Topics may only be strings, and the values provided in an
index may only be strings and numbers. If these rules are broken in development mode, an early error
is now issued.

#### Client side events

Archivist on the client is now an event emitter. After an operation is completed, archivist emits
the topic as the event name with opName and vaultValue. This enables game developers to set up
event listeners to handle the creation of topics on the client side. Here's an example:

```javascript
mage.archivist.on('raidBoss', function (opName, vaultValue) {
	exports.raidBosses = vaultValue.data;
});
```

#### Bugfixes

An `archivist.del()` operation was not setting the value as initialized. The result of this would be
that if a `del` was executed without being preceeded by a `get`, a follow-up `get` in the same
transaction (state instance) would still hit the datastore, rather than accept that the value has
been deleted.

Fixed an issue with diff distribution that could occur if distribute was called more than once
during a request.

Fixed an issue with archivist component where `rawList` was not properly being aliased to `list`.

### Shokoti

The `cronClient` module that you use to talk to Shokoti, now allows for timezones *per job*. You
can use this by calling `setJob` with one more argument. Shokoti will also give you a message
object, which will contain some interesting information. Example:

```js
var timezone = 'Asia/Tokyo';

mage.cronClient.setJob('generateRanking', '0 0 0 * * *', timezone, function (state, message, cb) {
	// generate ranking at midnight (Tokyo time)
	logger.debug('Time on the Shokoti server:', message.meta.localTime);
	logger.debug('Timestamp of this job execution:', message.meta.thisRun);
	logger.debug('Timestamp of the next scheduled job execution:', message.meta.nextRun);

	cb();
});
```

The `timezone` argument is optional, as is the `message` argument in your callback, so the following
still works:

```js
mage.cronClient.setJob('generateRanking', '0 0 0 * * *', function (state, cb) {
	// generate ranking at midnight (using whatever timezone Shokoti has been configured with)
	cb();
});
```

If you want to use Shokoti with timezones, you must make sure you are using
**Shokoti v0.3.0 or later.** Please check with your sysadmin to make sure **all** environments you
deploy on have the right version of Shokoti for you.

Other improvements:

* Cron client now logs a notice when jobs start and complete (so you **no longer have to do this**
  yourself).
* You can now also configure a different endpoint for Shokoti to call back to, although by
  default it will still use your application's exposed URL.

### Logger

The client side logger will now serialize objects to parseable JSON even if they contain circular
references. It also knows how to deal with special objects like `window`, text nodes and DOM
elements. When serializing a DOM element, it will generate a querySelector compatible path to the
element and log it. For example:

```js
var btn = document.querySelector('button');

btn.onclick = function () {
	var view = document.querySelector('.view[inventory]');

	try {
		openView(view);
	} catch (error) {
		mage.logger.error('Player clicked button', btn, 'to open', view, 'but failed:', error);
	}
};
```

And you would see a server side log similar to this:

```
w-13121 - 18:16:04.547     <error> [mage-app html5] Player clicked button
    "[DOM Element (#navInventory)]" to open
    "[DOM Element (html > body > div.mage-page > div.inventoryView)]" but failed:
    Error: Cannot open inventory while in tutorial
  data: {
    "error": {
      "name": "Error",
      "message": "Cannot open inventory while in tutorial",
      "stack": [
        "Error: Cannot open inventory while in tutorial",
        "    at openView (<anonymous>:2:29)",
        "    at HTMLButtonElement.btn.onclick (<anonymous>:6:3)"
      ]
    },
    "clientInfo": {
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1707.0 Safari/537.36"
    },
    "client": "html5"
  }
```

> To generate the selectors, we use the
> [unique-selector](https://github.com/ericclemmons/unique-selector) component.

### Message server client

#### Command modes

The message server client has traditionally always executed user commands on a per-batch basis. In
cases where you need to make sure a user command gets executed even if another has already been
sent to the server, developers were able to use the `mage.msgServer.queue(callback)` method. Now,
we open up the door to choosing between two modes on the message server: *blocking* and *free*.

##### Blocking mode

This is still the default behavior, and is how the message server has always operated: one batch of
commands at a time. This protects your application from button hammering, where one player tapping
a "Quest" button 20 times does not trigger 20 quest executions.

##### Free mode

This allows user commands to *always* be executed. If a user command is currently already being
executed, the next one will be delayed until the current one returns. In other words, it is
automatically queueing. On the dashboard, this has been enabled by default.

##### API

You can change between these two modes at any time, by using:

```javascript
var mage = require('mage');

mage.msgServer.setCmdMode('free'); // or 'blocking'
```

#### Piggyback

The message server already exposes a `queue(callback)` method to delay execution of a user command
until the HTTP channel is available again, in order to avoid `busy` errors. Often that deferred
execution will still affect the user experience in a negative way, by blocking the channel yet
again. There are use cases where all you want to do is send a user command with the next batch
(whenever that may be). To accomplish that, we have added a `piggyback(callback)` method.

The callback will be fired immediately, and your user command call will be registered. It will
however not be sent to the server yet. Instead it will be queued and will be sent with the next
batch.

### Component changes

The Tomes and Rumplestiltskin components required by the archivist client are now included by
referring to their repositories. This avoids issues that arise when a component is included in a
game's package.json file which causes it to not appear in MAGE's node_modules directory.

### Dependency updates

| dependency        | from         | to           | changes   |
|-------------------|--------------|--------------|-----------|
| component-emitter | 1.0.1        | 1.1.0        | [Changelog](https://github.com/component/emitter/blob/master/History.md) |

### Minor improvements

* Logs about invalid hostnames for mmrp nodes have been filtered to leave only relevant ones.

### Bugfixes

* If an exception happened before mage tasks are setup, an exception would be thrown by `mage.quit`
  about `this.getTask()` being `undefined`. This fixes it.
* When the process was killed when a user terminal disconnected, it would leave .sock files behind.
  This was due to MAGE not handling the SIGHUP signal, which has been addressed.
* The `node` object in the serviceDiscovery module was referring to `../../../mage` instead of
  `../mage` which by some incredible luck was working in most conditions, but not when
  `node_modules/mage` is a symbolic link to a folder that wasn't named `mage`.
* A very rare log in `serviceDiscovery/node.js` was not using the right syntax causing an exception.


## v0.24.2 - Tomes Hotfix

Tomes got updated to v0.0.17, as it fixes a bug that one if our apps has been experiencing. This
version of Tomes works around that (seemingly) browser bug.


## v0.24.1 - CommandCenter Client Hotfix

CommandCenterClient now outputs more useful logs, and no longer auto-retries after network errors.


## v0.24.0 - Bullettime Cat

### Shutdown changes

Tasks can now implement a shutdown function that will be called during mage shutdown. Great care
should be taken so that those functions never fail as it will prevent mage's master process from
fully shutting down. It allows mage core modules to have possible async work done before exiting.

**Breaking change:**

The signature of `mage.quit` was changed from `quit(graceful, exitCode)` to only `quit(exitCode)`.
The concept of graceful shutdown has been scrapped and it is now considered that every shutdown
should be as graceful as possible. If your project ever calls `mage.quit`, please update it now.

### Speed up dashboard builds

The component builder has been made much more efficient, allowing builds with many component pages
(ie: dashboard) to build an order of magnitude faster.

### Client logger

The disableOverride configuration option in the client logger now matches the documentation and also
disables uncaught exception handling. The relevant config entries are:

```yaml
logging:
    html5:
        console:
            disableOverride: true
        server:
            disableOverride: true
```

### Ident module

Added `registerPostLoginHook` and `unregisterPostLoginHook` functions to the `ident` module to setup
hooks after login that are called with the state and a callback, if the hook sends an error to the
callback then the login is marked as failed and the session reset. For example if you wanted to write
a small module to ban users:

```javascript
// in my module setup, a small hook is added to check if a user is banned and deny access
// first parameter is the app name, an engine name can be provided as a second argument
// to target a specific engine but is optional
mage.ident.registerPostLoginHook('game', function (state, cb) {
	var index = { actorId: state.actorId };
	var options = { optional: true };

	state.archivist.get('banList', index, options, function (err, data) {
		if (err) {
			return cb(err);
		}

		// return an error if the user is banned
		if (data) {
			return cb(new Error('User "' + state.session.actorId + '" is banned.'));
		}

		// all is fine, let the login function succeed (or go to the next hook in the list)
		cb();
	});
});
```

### Archivist improvements

* If you configure a topic with an index that is not an array, MAGE will now quit with an error on
  startup.
* In development mode (as the check is quite heavy), if you try to access a document using an
  incomplete or badly named index, it will be detected and an emergency will be logged.

### Client configuration

When the browser requests a page through MAGE, it can send along a so called "client config". This
contains up to three values:

- language (fallback: "en")
- screen resolution (fallback: 0x0)
- pixel density (fallback: 1)

If any of those values was not provided, the fallback value would be used. These fallback values
have been updated to better reflect the capabilities of the application. Most importantly, the
fallback language is no longer English, but the first configured language for the application.

It is also important to note, that previously the fallback resolution was 1x1. This would create
problems when a device would report its resolution as 0x0 (which happened). Therefore, the fallback
resolution has been reduced to 0x0.

### Minor improvements

* Removed the rethrow function from the Router in the dashboard as well as the try catch so that
  hopefully if / when you get errors you will be able to track them down easier.
* Removed the fixup to the rootPath of MAGE that occured when you ran a MAGE game outside of its
  directory. This is necessary to allow developers to run unit tests. Now that we have a Makefile
  all interactions with your game should take place in the game's root directory (ie. /home/bt/game)
* We now also log the exit code and process run time on shutdown.
* The configuration provided in the project template now sets up a 1-worker cluster, rather than
  running in solo-mode.

### Dependency updates

| dependency     | from         | to           | changes   |
|----------------|--------------|--------------|-----------|
| node-memcached | 0.2.5        | 0.2.6        | [Changelog](https://github.com/3rd-Eden/node-memcached/blob/master/CHANGELOG.md#026) |
| highlight.js   | 7.3.0        | 7.4.0        | [Website news](http://highlightjs.org) |
| node-semver    | 2.1.0        | 2.2.1        | [Commit log](https://github.com/isaacs/node-semver/commits/master) |
| jshint         | 2.1.11       | 2.3.0        | [Release notes](https://github.com/jshint/jshint/releases) |


## v0.23.5 - LDAP Cat

### Module dependency chains

MAGE now officially supports calling `mage.useModules('abc')` from other modules on the server.
Dashboard now always calls `mage.useModules('ident')`, so **you no longer have to** (but you may).

### Identification module updates

* The identification module now provides a tool on the dashboard to create users for the `userpass`
  engine.
* The `userpass` engine now use salts by default and supports `pbkdf2` hashing.
* Added a `ldap` engine.
* If the game is not configured correctly, an error will be displayed on the dashboard.
* When using the `anonymous` engine, the dashboard will now auto-login you.
* Updated some of the `mage.ident` server API functions to allow admin users to poll/query data
  on different apps instead of the current one.

You **will need to update your configuration**. Everything that was under:

```yaml
module:
	ident:
		# your app names and config here
```

Needs to move under an entry called `apps`:

```yaml
module:
	ident:
		apps:
			# your app names and config here
```

### Minor improvements

* Expired sessions are no longer logged as a warning, but are now marked at the "debug" level.
* msgServer now decodes the URI when handling routes so it can deal with routes with
  characters that need to be escaped, like spaces.
* .sock files are cleaned up if `process.exit()` is called. Mocha calls process.exit when doing unit
  tests and without this change it leaves .sock files laying around. Savvy already listens for
  process.exit, msgServer now matches that behavior and performs the same task whether it's
  mage#shutdown or process#exit.
* The shard rights management now allow admins to access all entries if no shard function is defined.
* The state object provides a `canAccess(level)` method that can be used for checking user rights in
  user commands. It returns `true` if the user has at least that level of access.
* Archivist cache is now ignored whenever displaying a document in the archivist dashboard, ensuring
  you will always see the latest version.

### Bugfixes

* The `archivist.assertTopicAbilities` function was failing to detect if the topic itself was missing
  and return a cryptic error to the user when that happened.

### Dependency updates

| dependency    | from         | to           |
|---------------|--------------|--------------|
| graylog2      | 0.1.0        | 0.1.1        |


## v0.23.4 - Cat'n Hook

### Replaced WebApp firewall with request hooks

The WebApp firewall function has been deprecated and replaced with a more generic request hook API.
The idea is to register request hooks to an app which will be executed on each request. If all is
fine, the request will proceed as per normal. However if there is a problem, the hook may return a
response code, header and message body. This could essentially be used for any form of request
checking.

Setting the `app.firewall` function will register it as a request hook and work as before, with a
deprecation warning.

To implement a device compatibility handler for webkit support you would do something like this:

```javascript
var useragent = require('useragent');
var game = mage.core.app.get('game');

game.registerRequestHook(function (req, path, params, requestType) {
	// By filtering by requestType, we improve performance of all commands

	if (requestType === 'webapp') {
		if (!useragent.is(req.headers['user-agent']).webkit) {
			return { code: 303, headers: { 'Location': 'http://some.url.com/' }, output: null };
		}
	}
});
```

### Identification module

An ident module has been added to MAGE, providing anonymous (development mode only) and classic user
and password login. Usage is fairly simple, first add some configuration based on your app to enable
the right engine(s):

```yaml
module:
	ident:
		# here is your app name, usually game
		game:
			# like archivist, any name will do here, allows you to swap engines easily
			main:
				# available engine types for now are "anonymous" and "userpass"
				type: userpass
				config:
					# the access level provided to the user, if not provided default to the lowest
					access: user
					# default topic is credentials but you can override it here, that topic expects
					# the index to be ['username'] and contain a 'password' field in the data
					#topic: user
			# add another config for anonymous login
			dev:
				type: anonymous
				config:
					access: user
```

Once that config has been set up, you will just need to run the following code to log in.

```javascript
// Here we use the "main" engine, which was defined as userpass. The "userpass" engine expects a
// username and password. If you were calling the "dev" engine instead, you could provide an access
// level. See the engines' documentation for more details.

mage.ident.check('main', { username: 'bob', password: 'banana' }, function (err) {
	if (err) {
		// display some error to the user
		return;
	}

	// login was successful, display the game
});
```

The dashboard is by default plugged on the anonymous engine. You can set it up to use username and
password by overriding the default configuration. The engine is expected to be named `default`.

For now that's it, as more engines make their way in, you will also have access to components to
help with the heavier authentication frameworks. Read the
[ident documentation](lib/modules/ident/Readme.md) for more details.

**Please note**: If you are using dashboards, you *must* call `mage.useModules('ident');` in your
server code, else you will not be able to log in.

### Minor improvements

* Added event emission `panopticonRegistered` in sampler when panopticon instances are created.
* You can now get the name of the app from your state object with `state.appName` (during user
  commands).
* You can also get the current access level of the user in the state object using `state.access`
  (during user commands).
* During shutdown, we could end up in a race condition that would log a ZeroMQ disconnect error.
* Archivist now gives a JSON.parse error instead of a "No encoder found" error when JSON data cannot
  be parsed.
* Logging in the command center has been improved: better timing for batches and replaced some
  `info` logging with `debug`.


## v0.23.3 - TP Cat

### msgServer interconnections

The way master and worker connected through ZeroMQ was a bit too strict. When there was a version
mismatch, the master and worker would refuse to share events. This is a bit silly, as we know that
after a `make reload` operation the version on the workers may have changed. When this happens, the
master will keep its previous version, but allow the mismatch with its worker to happen.

When master processes communicate with their peers however, the check is still strict: the
application name and version *must* match in order for them to connect and communicate messages.

We also made it so that relays will now explicitly disconnect from relays that went down. Not doing
this will result in ZeroMQ trying to reconnect to the missing relay indefinitely. For the longest
time, ZeroMQ did not implement a `disconnect` function, but recently this was added and received
support in ZeroMQ for Node.js.

### Minor improvements

* When the logger sends a browser error to the server, it will now include the user agent string.
  We also took the opportunity to make the log data structure for these cases a bit flatter.
* The configuration files that come with the bootstrap template have been annotated with
  explanations about the meaning of each entry.

### Critical MySQL bugfix

The previous release (v0.23.2) introduced support for MySQL connection pools. This introduced a bug
when trying to use `make datastores` (when a MySQL vault was configured), because the database
creation would no longer be able to extract the database name from the configuration. This has been
addressed.


## v0.23.2 - Basketball Cat

### Security advisory

Node.js 0.8.26 fixes a critical security bug in the HTTP server. Read more about it [on the Node.js
website](http://blog.nodejs.org/2013/10/22/cve-2013-4450-http-server-pipeline-flood-dos/).

### New client-side msgServer error: "maintenance"

The msgServer client can now also yield a `maintenance` error (thanks Tien) during the execution of
a user command. On the http transport, this happens when a "503 Service Unavailable" is encountered.
Your game MUST take this into account or risk locking up when this error is encountered. The
following code can be added to where you set up the rest of your msgServer event handlers:

```javascript
mage.msgServer.on('io.error.maintenance', function () {
	// Do whatever logic your game requires for maintenance mode.
	// In this case, we retry the user command and we use a long timeout, because our server is
	// either under heavy load or under real maintenance. That means that this may take a while, and
	// we don't want to needlessly overwhelm the servers with requests.

	window.setTimeout(function () {
		mage.msgServer.resend();
	}, 30 * 1000);
});
```

### Support for CORS

If you want your application to span multiple domains, you need to enable CORS. This can now be
enabled through your configuration. For more information, please read the
[Message Server documentation](lib/msgServer).

### Documentation

A new document has been added: [Taking your MAGE game to production](docs/production).

A number of small errors in the various parts of the documentation have been addressed.

### Makefile

In our ongoing efforts to make installation, CI and deployment simpler, we have revisited the
behavior of `make clean`. It used to clear the npm-cache. That is no longer the case. Now, when you
run `make clean`, it removes your `components` and `node_modules`. However, it will *not* remove
them if they are part of your git repository.

We have also renamed `clean-npm` to `clean-deps` (which now includes components), and we have merged
`clean-coverage` and `clean-complexity` into `clean-report`.

We have reordered the commands that `make deps` runs to install components *after* git submodules,
(thanks Micky) since the building of components might depend on those. The previous version could
fail to install your dependencies on a fresh install of your project.

Because of these changes, **please run the following command** and commit this to your repository:

```bash
cp ./node_modules/mage/scripts/templates/create-project/Makefile ./Makefile
```

### MySQL update and pool connections

The `mysql` node module has been updated from `2.0.0-alpha7` to `2.0.0-alpha9`. It means that the
vault now uses connection pools, see here for more details:
[Pooling Connections](https://github.com/felixge/node-mysql#pooling-connections).

The `pool` property is now available on the vault object, the `connection` property is still available
but now links to the pool itself and is deprecated. For people updating, calling `query()` directly
on the pool property instead of connection will work the same as before.

If you have series of queries you want to run on a single connection (for performance or transaction
reasons) then the following code can be used:

```javascript
function myAwesomeFunction(state, cb) {
	// get the vault as usual, but take the pool
	var pool = state.archivist.getWriteVault('mysql').pool;

	// ask for a connection
	pool.getConnection(function (err, conn) {
		if (err) {
			return cb(err);
		}

		async.series([
			function (callback) {
				conn.query('SELECT something FROM somewhere', function (err, rows) {
					if (err) {
						return callback(err);
					}

					// do something with those rows ...

					callback();
				});
			},
			function (callback) {
				conn.query('UPDATE somewhereelse SET anotherthing = anothervalue', callback);
			},
			// maybe more ...
		], function (err) {
			// we are done, release the connection asap, allows other peoples to use it
			conn.release();

			// then we are done, using the connection at this point will not work
			cb(err);
		});
	});
}
```

### Minor improvements

* The File vault is now a bit more robust to handling failed or half-completed writes.
* We made the log message a bit friendlier when building a component with "files" attached.
* We moved service discovery configuration defaults into a file, so they actually show up when you
  display config.
* For service discovery, mDNS service names longer than 63 bytes are now converted to a sha1 hash
  instead of generating an error, a warning will be displayed to the user when it is the case.
* The dashboard doc browser now supports anchors, just hover to the left of a title to get a copyable
  anchor, also anchors can be used for links between documents the same as in GitHub.
* The daemonizer would error on `reload` if the app was not yet running. Now it will simply start
  the app instead.

### Dependency updates

| dependency    | from         | to           | notes           |
|---------------|--------------|--------------|-----------------|
| tomes         | 0.0.15       | 0.0.16       |                 |
| node-uuid     | 1.4.0        | 1.4.1        |                 |
| aws-sdk       | 1.5.2        | 1.8.1        |                 |
| elasticsearch | 0.3.11       | 0.3.12       | Renamed to "es" |
| mysql         | 2.0.0-alpha7 | 2.0.0-alpha9 |                 |
| js-yaml       | 2.1.1        | 2.1.3        |                 |
| redis         | 0.8.4        | 0.9.0        |                 |

### Bugfixes

* When writing data from the archivist client to the server, it would not pretty-stringify JSON and
  tomes. This has been fixed, at the slight cost of an increased transport size. This should however
  only affect the dashboard, since no data mutations are allowed to be made by game clients. (thanks
  Almir)


## v0.23.1 - Derp Cat

### Bootstrap improvements

We have removed the `serverCache` configuration entry from the bootstrap template (this feature was
removed in v0.23.0).

If the bootstrapping is done with environment variable `NOQUESTIONS=true`, all defaults are applied
without prompts. It's also checked for when running `make dev`. This is a useful feature during CI.

During the bootstrap phase, `make deps` has been replaced with `make all`.

The default values for the serverHost and savvy expose have become empty string, which will work
unless `index.html` is hosted elsewhere (which is the case with PhoneGap for example).

#### Bugfix from v0.23.0

In v0.23.0 we forgot to update the default precommit command to the new Makefile test-target, so
please run this one more time:

```bash
cp ./node_modules/mage/scripts/templates/create-project/scripts/githooks.js ./scripts/githooks.js
make dev
```

### DynamoDB read consistency changed

Before that update, reads would be eventually consistent by default, with no way to change it. Now
the default is to have strongly consistent read with a way to set that value per topic. See the
[vault documentation](lib/archivist/vaults/dynamodb/Readme.md) for more details.

### Minor improvements

* The generated `Readme.md` file for new projects now completely describes the installation process.
* If a user command did not expose an `execute` function, the error message was very cryptic.
* We have slowed down the interval with which the logger stream in the dashboard tries to reconnect
  from 500ms to 2s.
* Improved error logging in Savvy.
* If no Savvy expose URL has been configured, we default to clientHost's exposed URL + `/savvy`.
* If the logger client failed to send an error report to the client, don't augment it with more
  error reports which detail how sending an error report failed.

### Bugfixes

* Daemonizing in node 0.10 would cause an assert error in node.js itself, it's now fixed.


## v0.23.0 - Ninja Cat

### Logger

The logger client now automatically logs uncaught exceptions. That means that if you currently have
this set up manually, you should remove that code from your codebase.

### Removed: serverCache

The configuration entry `apps.myapp.delivery.serverCache` has been removed in favor of the already
existing development mode. From now on, when development mode is turned on MAGE will not prebuild
any apps. When it is turned off, MAGE will prebuild all apps.

### Offline builds

MAGE now allows you to generate builds for the web once. You can do this by running `make build`,
which will generate the builds and store them in a `./build` directory in your project, which is
automatically created. Builds are only loaded when development mode is turned off. If you have to,
you can test your builds by running your game like this: `DEVELOPMENT_MODE=false ./game`.

Because builds may get outdated if not regenerated after code changes happen, it's advisable not to
commit them into your repository (add `/build` to your `.gitignore` file.), unless you recreate the
build automatically using a pre-commit hook.

Because the generated build is not required to lint (and most likely won't), add the `build/**` to
your `.jshintignore` file.

> **Why bother?**
>
> This is a useful feature for production environments. Normally, each worker in a cluster (often
> configured to be one worker per CPU core) would generate the same build and keep this in memory. It
> works, but can get very slow due to the hard disk access involved. Generating these builds once and
> then reusing them solves the problem and becomes more manageable for production deployments.

### Makefile updates

After more constructive conversations between various parties involved, we have decided on a new
Makefile format (again). This new format should make it easier to do continuous integration tests,
and should make it more straight forward to get started, for developers who are new to a project.

#### In a nutshell

* `make all` now does a full installation of all dependencies, will create and migrate databases if
  possible and required, and will generate a build of your apps.
* `make test` now runs the lint test and unit tests, and lint-staged has become an argument
  `filter=staged` which can be applied on `make test` or `make test-lint`.
* `make report` now creates the Plato and Istanbul reports.

#### How to update your project

Do this once and commit the changes to your project:

```bash
cp ./node_modules/mage/scripts/templates/create-project/scripts/githooks.js ./scripts/githooks.js
cp ./node_modules/mage/scripts/templates/create-project/Makefile ./Makefile
```

#### For every developer

Because the make commands changed for linting staged files, the pre-commit git hook should be
rewritten for each developer working on the project. Each developer should run:

```bash
make dev
```

And accept the suggested default make-arguments.

#### The new `make help` output

```
Getting started:

  make help              Prints this help.
  make version           Prints version information about the game, MAGE and Node.js.
  make all               Installs all dependencies and datastores (shortcut for deps, datastores and build).

  make deps              Installs all dependencies (shortcut for deps-npm, deps-component and deps-submodules).
  make datastores        Creates datastores and runs all migrations up to the current version.
  make build             Creates builds for all apps.

  make deps-npm          Downloads and installs all NPM dependencies.
  make deps-component    Downloads and installs all external components.
  make deps-submodules   Downloads updates on git submodules.

Development:

  make dev               Sets up the development environment (shortcut for dev-githooks).

  make dev-githooks      Sets up git hooks.

Quality:
  make test              Runs all tests (shortcut for test-lint and test-unit).
  make report            Creates all reports (shortcut for report-complexity and report-coverage).

  make test-lint         Lints every JavaScript and JSON file in the project.
  make test-unit         Runs every unit test in ./test.
  make report-complexity Creates a Plato code complexity report.
  make report-coverage   Creates a unit test coverage report.

  available variables when linting:
    filter=staged        Limits linting to files that are staged to be committed.
    path=./some/folder   Lints the given path recursively (file or folder containing JavaScript and JSON files).

Running:

  make start             Starts the application daemonized.
  make stop              Stops the daemonized application.
  make restart           Restarts the daemonized application.
  make reload            Recycles all workers with zero-downtime (not to be used on version changes).
  make status            Prints the status of the daemonized application.

Cleanup:

  make clean             Cleans all builds, caches and reports.

  make clean-build       Cleans all application builds.
  make clean-npm         Cleans the NPM cache.
  make clean-coverage    Removes the test coverage report and its instrumented files.
  make clean-complexity  Removes the Plato report.
```

### Archivist

Added a method `addToCache` to archivist that allows the user to manually push data to the archivist
cache, it should be used only in very specific cases. See the
[archivist documentation](lib/archivist/Readme.md) for more details on how to use it.

#### DynamoDB

* Migration scripts can now be written for DynamoDB. Please refer to the vault's
  [Readme.md](lib/archivist/vaults/dynamodb/Readme.md) for more details about those scripts and the
  rules around them.
* Documentation has been updated to take in account local servers.

### Minor improvements

* Regular expressions now stringify neatly when passed to the logger.
* Logging of asset serving has become a little bit more verbose.
* Boot durations are now logged for each process.
* Apps were also instantiated on the master process, that has been removed.
* The default bootstrap script now also asks for a MAGE repo URL, so 3rd party forks can also be used.

### Bugfixes

* The `add` method of the MySQL vault was broken.
* The websocket logger could under certain circumstances leave socket files behind.
* The client logger was not overriding the console as advertised.
* The DynamoDB topic APIs `deserialize` and `createKey` were broken.
* Fixed dead links in the API doc of the DynamoDB vault.

### Dependency updates

| dependency | from   | to     |
|------------|--------|--------|
| ws         | 0.4.30 | 0.4.31 |
| jshint     | 2.1.10 | 2.1.11 |
| mocha      | 1.12.1 | 1.13.0 |
| istanbul   | 0.1.43 | 0.1.44 |
| plato      | 0.6.1  | 0.6.2  |
| js-yaml    | 2.1.0  | 2.1.1  |


## v0.22.2 - Puss in Boot

### show-config

The CLI command `show-config` now can take a `--origins` argument which will show for each config
entry which configuration file it came from. Also, when printing configuration, at the top of the
output is now a distinct list of all the files that made up this configuration. This file list is
output on `stderr`, so it does not affect the output when you run:

```bash
./game show-config archivist > ./archivist-config.json
```

### Minor improvements

* We optimized the boot path the Message Server takes, allowing it to be accessible to other
  systems, but not yet discovering and connecting to other hosts on MMRP. This should avoid some
  error cases when running the `component-install` or `create-phantom` CLI commands while an app is
  already running.
* When a config file cannot be found for an environment, the name of the environment is now logged
  with the warning.
* Vault migrations now yield clear errors when an `up` or `down` method is missing.
* We have rearranged some boot-time operations to allow verbose mode to kick in earlier so it can
  display what's going on inside the config system.

### Bugfixes

* A missing migrations folder for a vault could yield a nasty error.
* A build failure on boot-time was not treated fatal, leaving the application running but unusable.


## v0.22.1 - Sock Cat

### Socket files

MAGE can create up to four `.sock` unix socket files in your game's root directory. These are used
by:

- The HTTP server
- The Savvy HTTP server
- The WebSocket log writer (two sock files)

There were circumstances under which these files would not clean up on shutdown. These cases have
now been resolved. The only case under which they can still not be cleaned up is on `SIGKILL` (or:
`kill -9`), because on that signal the operating system terminates the program without giving the
program the ability to intervene.

### Daemonizer

The daemonizer's behavior has been changed to be a bit more friendly:

* `start` will now succeed if the app is already running.
* `stop` will now succeed if the app is not running.
* `restart` will no longer abort if the app is not running.
* `restart` will no longer abort if the app was stopped, but returned an error on shutdown.

### Fixes

The archivist documentation that described the client API was out-of-date. This has been resolved.


## v0.22.0 - Builder Cat

### Component plugins

`WebApp` objects that are instantiated for each app are now EventEmitters. This allows builders to
share information on a per-app basis. When components are built, the `build-component` event is
emitted, which passes the `builder` object (from
[component-builder](https://npmjs.org/package/component-builder)) and the `buildTarget` objects that
MAGE creates for each page that gets built.

Having access to the builder allows you to register plugins. For example:

```bash
npm install -s component-uglifyjs
npm install -s component-less
```

```javascript
mage.setup(function (error, apps) {
	// when mage is running in development mode, we don't uglify

	if (!mage.isDevelopmentMode()) {
		var uglify = require('component-uglifyjs');

		apps.game.on('build-component', function (builder, buildTarget) {
			builder.use(uglify);
		});
	}

	var less = require('component-less');

	Object.keys(apps).forEach(function (appName) {
		apps[appName].on('build-component', function (builder, buildTarget) {
			builder.use(less);
		});
	});
});
```

This change, which allows us to do all CSS related operations through component, also means that our
builder will no longer brute-force scan directories for stylesheet files. Instead, the `"styles"`
field from your `component.json` files is used. So please make sure you are using these fields
correctly.

This also means that the old post-processor system has been deprecated, and you should remove the
"postprocessors" objects from your configuration:

```yaml
apps:
  game:
    delivery:
      postprocessors: etc
```

### Archivist

* Added the ability to turn off expiration time support in file vault (see the
  [file vault documentation](./lib/archivist/vaults/file/Readme.md) for more information).
* The file vault now runs the expire scan on up to 20 files in parallel to speed up performance.
* Refactored the archivist setup sequence for vastly better error reporting.
* `archivist.assertTopicAbilities()`: where in the past, a single vault that supports the required
  operations would be enough, now all configured vaults that will be used must support it. This
  moves these errors from runtime to startup.

### File logger update

File logger now stores both the time and date in [ISO 8601](http://en.wikipedia.org/wiki/ISO_8601)
format (YYYY-MM-DDTHH:mm:ss.sssZ).

### Changed vaults' setup to async

From time to time, users would get weird errors when encountering a syntax error in their own module
that would appear as a vault error or something similar. The issue is caused by some functions not
being consistent on the way they return, either being async or sync and context being mixed up
because of that. Vaults are a big culprit for this kind of stuff, and it is now fixed for the setup
phase.

See this link from [isaacs](http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony) for
more details about the issues that not being consistent between async and sync can cause.

There is still a lot of code that doesn't respect that line of conduct. When encountering this in
your own modules, wrapping your instant callbacks in `process.nextTick` will solve the issue most of
the time. If the issue is instead in MAGE, then please send us the whole stack-trace so that we can
fix the issue and make your debugging a healthier experience. When doing so please make sure to send
us the whole stack-trace (see the next item for that).

### Added a --stack-limit argument to the CLI

By default Node.js truncates stacks to 10 items. That may be good enough in most cases but sometimes
when using the `async` module and very deep levels of nested callbacks it may not be enough, in
those cases you can pass `--stack-limit <n>` to your game's command-line to change the stack limit
to a deeper level. Acknowledge though that using large numbers will make your code slower when
creating Error objects. Using 0 will disable stack trace collection.

### Bugfixes

* The `maintenance` event was not being fired correctly in the MAGE loader.
* When using node 0.10+, calling the cron client would result in the command center client staying
  in a busy state, preventing any future call and killing performance.
* If the `NODE_ENV` environment variable is not set, MAGE would not abort appropriately.
* Tested and fixed the general trunk of the environment setup script (thanks Marc!).
* Tested and fixed the environment setup script for Ubuntu (thanks Marc!).

### Minor improvements

* Savvy doesn't need a host anymore when listening on a port, will default to `INADDR_ANY` if
  undefined.
* The script that sets up git pre-commit hooks has been rewritten in JavaScript.
* The template for new projects now sets the first version to v0.1.0 (rather than v0.0.1).
* We removed `component.json` from the root directory of the "create project" template, since we
  don't follow that model anymore.


## v0.21.0 - Colonel Meow

### Template updates

The "new application" template has been updated with the following changes:

* A new Makefile (see below)
* Because the Makefile is prefered over npm-scripts, package.json no longer implements `reload`,
  `lint-all`, `lint-staged` and `git-setup`.
* Reverted the change to package.json where the "main" field got removed (in v0.19.0), since we want
  `node .` to function properly in continuous integration and other automation (the Makefile depends
  on it).
* Updated the mocha dependency from v1.12.0 to v1.12.1.

### Makefile

The Makefile has been completely rewritten to better suit the needs of sys ops and developers alike.
The following text is the help output which you can access by calling `make` without arguments.

```
Getting started:

  make help              Prints this help.
  make install           Installs the environment (shortcut for install-deps and install-archivist).
  make version           Prints version information about the game, MAGE and Node.js.

  make install-deps      Installs all NPM dependencies.
  make install-archivist Creates databases and runs all migrations up to this version.

Development:

  make dev               Sets up the development environment (shortcut for dev-githooks).

  make dev-githooks      Sets up git hooks.

Quality:

  make lint              Lints every JavaScript and JSON file in the project.
  make test              Runs all unit tests.
  make coverage          Creates a unit test coverage report.
  make complexity        Creates a Plato code complexity report.

  make lint path=abc     Lints the given path recursively (file or folder containing JavaScript and JSON files).
  make lint-staged       Lints every JavaScript and JSON file in the project that is staged to be committed.

Running:

  make start             Starts the application daemonized.
  make stop              Stops the daemonized application.
  make restart           Restarts the daemonized application.
  make reload            Recycles all workers with zero-downtime (not to be used on version changes).
  make status            Prints the status of the daemonized application.

Cleanup:

  make clean             Cleans all caches and reports.

  make clean-npm         Cleans the NPM cache.
  make clean-coverage    Removes the test coverage report and its instrumented files.
  make clean-complexity  Removes the Plato report.
```

### Minor improvements

* Getting, listing and distributing on archivist now shows read-, list- and write-order in the log.
* We've made component builder errors a tiny bit more verbose (they can be very cryptic).

### Dependency updates

| dependency | from   | to     |
|------------|--------|--------|
| graylog2   | 0.0.2  | 0.1.0  |


## v0.20.0 - ElastiCat

### Database Schema Migrations

Archivist now allows you to manage your schema migrations. This is (for now) limited to MySQL only.
Read all about it in the [Schema Migrations documentation](./lib/archivist/SchemaMigrations.md).

### DynamoDB Vault

Archivist has been enriched with support for Amazon's DynamoDB through the
[aws-sdk](https://npmjs.org/package/aws-sdk) module. Read the
[DynamoDB vault documentation](./lib/archivist/vaults/dynamodb/Readme.md) for more information.

### Elasticsearch Vault

Archivist has been enriched with support for Elasticsearch through the
[elasticsearch](https://npmjs.org/package/elasticsearch) module. Read the
[Elasticsearch vault documentation](./lib/archivist/vaults/elasticsearch/Readme.md) for more
information.

### New service discovery engine

A new service discovery engine is being deployed, it removes some outstanding bugs such as the 14
character limit for game names and removed the tight coupling it had with the `msgServer` allowing
developers to uses it in other modules more easily. MAGE startup time should also have been improved
noticeably.

It also includes a new engine named `zookeeper` that allows service discovery even on networks
incompatible with `mDNS`.

For configuration, the old configuration `server.mmrp.serviceDiscovery` can be removed. When using
`mdns` no configuration is needed, if you want to use or try `zookeeper`, please check the
documentation.

For more details, please read the provided [documentation](./lib/serviceDiscovery/Readme.md).

### Minor bugfixes

* Certain CLI tasks would misbehave when MAGE was set up to have more than 1 worker. The commands
  could end up running in parallel.
* Fixed the case where an unavailable URL in a markdown doc navigation would mess up browser
  navigation.
* Matryoshka (our configuration system's internal data representation) could break in a very
  particular edge case when querying for a particular configuration trail.
* Fixed a bug where using the file vault in cluster mode would cause a race condition when
  a worker would set a TTL on a file and that entry would be touched by another worker, not
  updating the timer in the previous worker. The result was that the file would be deleted
  even though it was not expired yet.

### Other small improvements

* The deprecated `session.setCurrentVersion` function has been removed.
* Due to the fact that the node-mdns module is unmaintained, we have released our own fork and now
  run on that.
* The logger system now more verbosely logs about its own state.
* We have reduced the sampler backlog to 100 entries (from 1000) to reduce its default memory
  footprint.
* Authentication errors can now carry a message, and for version mismatches it does. The dashboard
  uses this and offers the users to re-login.
* We added a small function `mage.dashboard.getAppNames()` which returns an array
  `['dev', 'support', 'cms']`, which are the dashboard apps. In the future you will be able to
  manipulate what the app names are for the dashboard.
* The error that is being logged when a non-optional `archivist.get()` call fails now includes the
  topic and index.

### Dependency updates

| dependency | from   | to     |
|------------|--------|--------|
| zmq        | 2.5.0  | 2.5.1  |
| semver     | 1.1.4  | 2.1.0  |
| ws         | 0.4.28 | 0.4.30 |
| component  | 0.17.0 | 0.17.2 |
| mocha      | 1.12.0 | 1.12.1 |


## v0.19.2 - Stringy Cat

Hotfix release to ensure JSON is *always* pretty stringified. This removes the flexibility of
encoding JSON in two modes, but nobody needed that anyway. This should make filevault writes much
friendlier to diffing.


## v0.19.1 - Captain Airplane Cat

### Terminal logger

The terminal logger now writes everything to *stderr*. Before it used to be mixed between *stdout*
and *stderr*. The reason for this, is so that CLI commands that output content can do this on
*stdout*, and the user can decide to write that output to file by calling (for example)
`./game show-config > ./fullconfig.json`. That file will not be cluttered with log entries.

### Added CLI command: show-config [trail]

You can now output the working configuration of the application through the `show-config` command.
By optionally given it a trail, you can output a sub-configuration. For example:

```bash
./game show-config archivist.vaults
```

Will output something like this on stdout:

```json
{
  "memory": {
    "type": "memory"
  },
  "file": {
    "type": "file",
    "config": {
      "path": "./filevault"
    }
  }
}
```

### Small improvements

* Archivist client now has a `maxAge` option for get/mget operations. Read
  [the documentation](./lib/archivist/Readme.md) for more info.
* Savvy no longer binds on sockets when tasks other than the default "serve" task are invoked,
  avoiding bind-collisions when running commands while a game is already running in the background.
* The `create-phantom` command now outputs to *stdout* instead of a file.

### And a mandatory bugfix

* Fixed the syntax highlighting in Markdown file rendering (was broken since 0.19.0).


## v0.19.0 - Roomba Shark Cat

### Removed tons of deprecated features

The following subsystems have been removed:

* The `PropertyMap` and `LivePropertyMap` classes.
* The `TimedNumber` and `TimedValue` classes.
* The `DataSources` class and its MySQL and Membase engines.
* Old-style browser modules and the `$html5client` build target (please use component).
* The tiny and pretty useless `mage.core.deprecator` library.
* The "bot" module which was never updated to use component (it has been replaced with a recipe in our cookbook).
* Dependency: `node-memcached-transactions`.

> Note: This cleanup effort has removed about **8000 lines of code**.

### Command line options and commands

MAGE has been given a modern command line interface. It contains all the commands previously
available, plus:

* `install-components` command (please read the **Component** section below)
* `create-phantom` command (to create a PhantomJS loader file for your app)
* `--version` option
* `--help` option (used to be the `help` command)

Also, a `-v, --verbose` option has been added which overrides the configured terminal logger
channels, and instead will simply output everything. Given that, it probably makes sense to set up
your terminal logger to log ">=debug", and when you do need more information out of the system, to
run your game with `-v`.

The CLI has been implemented using the [commander](https://npmjs.org/package/commander) module which
offers a nice API, which MAGE exposes as `mage.core.cli.program`. Read the commander documentation
for more information on how to add your own options and commands to it.

### The MAGE Task

The MAGE boot up process has always been divided into these steps:

1. Selection of modules to use: `mage.useModules();`
2. Asynchronously set up all subsytems, modules and apps: `mage.setup(cb);`
3. Optionally pre-build all pages and open the HTTP server to serve requests: `mage.start(cb);`

Step 3 in this flow has now become pluggable. That means that app-serving is simply one of
potentially many tasks that MAGE can accomplish after having been set up. This ties in neatly with
the new CLI system. The first example of this is the `./game install-components` command, which
will have MAGE (rather than serving apps) install all components for the apps. MAGE can be given a
different task by calling:

```javascript
mage.setTask(myFunction);
```

When `mage.start()` gets called, it will now run that function, and it will not start serving apps
on the HTTP server (which will remain closed).

This is how the `install-components` task is being set up:

```javascript
mage.core.cli.program
	.command('install-components')
	.description('Install all components used in apps and dashboards into ./components.')
	.action(function () {
		mage.setTask(require('./tasks/install-components'));
	});
```

### Component

The way MAGE integrates with Component has been completely rethought. Every unique build now needs
to have its own third party components installed. These components however all share the same
directory in which they get installed: `PROJECT_ROOT/components`. In order to facilitate ease of
installation (since there are many builds, including, but not limited to all pages) the
`install-components` command was created.

This new philosophy around components means the following:

- The only global path set up for you is `PROJECT_ROOT/components`.
- Other paths will need to be set for each individual component in `component.json`.
- Your project should **not** have a `PROJECT_ROOT/component.json` file, as it does not represent a single build.

#### Some other changes

A small side note is that we removed `/mage/component.json` as it wasn't being used.

When component-builder runs, it parses from the component.json an entry named files that can contain
any arbitrary files that the component may need. Those by default are copied to a folder in an
assets folder. Rather than having components copying stuff everywhere, we are disabling the
functionality and generating a debug log instead to warn the developer to whether copy or symlink
the file himself.

### Template updates

The `create-project` template has been updated to reflect the new approach to component. It also
names the main file of your project `./game` instead of `index.js`, and makes it executable. You
should therefore no longer run `node .` or `node . start`. Now you simply run your game by typing
`./game` or `./game start`. The advantages are:

- You have a much more natural entry point into your application and CLI.
- You no longer accidentally execute code when running `node .` in the wrong folder.

### Session module

To facilitate the new bot workflow, the session module client has been refactored. The
`randomSession` user command has been replaced. It now has the following user commands:

* `session.loginAnonymous` (replaces `randomSession`, requires development mode for non-anonymous access level)
* `session.loginAsActor` (to login unauthenticated as a specific actor, requires admin access or development mode)
* `session.reassignSession` (to move a session from one actor to another, requires admin access)
* `session.logout` (to end the running session)

The dashboard's `loginAnonymous` user command has been removed in favor of the one in the session
module.

The session module's `setSessionKey` method has been changed to the following:

```javascript
mage.session.setSessionKey(key, actorId);

var currentLoggedInActorId = mage.session.getActorId();
```

### Dependency updates

| dependency | from   | to     |
|------------|--------|--------|
| memcached  | 0.2.4  | 0.2.5  |
| zmq        | 2.4.0  | 2.5.0  |
| jshint     | 2.1.9  | 2.1.10 |
| mime       | 1.2.10 | 1.2.11 |
| ws         | 0.4.27 | 0.4.28 |

### Some other updates:

- The horrible copy-to-clipboard button in the dashboard has been replaced with a Flash based solution.
- The default (BOOTSTRAP=true) flow will now ask for base URLs for Savvy and the ClientHost.
- The Service Discovery name for mDNS now truncates the username part of the string to 2 characters during bootstrap.
- The "main" field was dropped from the game's `package.json`, as it doesn't really apply.
- JSHint configuration was moved from `./scripts/jshint.cfg` to `./.jshintrc`.

### And a mandatory bugfix

- The archivist JSON display was no longer getting its styles applied correctly.


## v0.18.0 - Serious Cat

### A new Shokoti and Cron Client module

This release marks a new generation of Shokoti, the MAGE task scheduler. The legacy system has been
given a facelift, with a simpler API, vastly reduced codebase and removing the use of deprecated
APIs.

MAGE's companion app [Shokoti](https://github.com/Wizcorp/shokoti) has been updated, and it now uses
a module called Cron Server. Your game can use the Cron Client module to schedule tasks. Read all
about it in the [Cron Client documentation](./lib/modules/cronClient/Readme.md)!

This update **removes** the `scheduler` and `schedulerServer` modules from MAGE.

### Bugfixes

* The MySQL vault's `set()` function was unable to overwrite existing values.
* Fixed behavior when dealing with multiple vaults that change encodings around. The old behavior could kill diffs.

### Minor improvements

* The error given when MMRP has not been configured has been made a bit clearer.
* Documentation for the MySQL vault has been augmented to describe how to set up tables.
* Changed the app's shortname requirement to 2-5 characters on install, to be more compliant with mdns.
* Changed logger channel for config file inclusions from `info` to `debug`.
* Upgraded [node-memcached](https://github.com/3rd-Eden/node-memcached/blob/master/CHANGELOG.md) from v0.2.3 to v0.2.4.
* Upgraded [jshint](https://npmjs.org/package/jshint) from v2.1.8 to v2.1.9.


## v0.17.2 - Spider Cat

### Minor improvements

* All dependencies in MAGE and the create-project template are now fixed to exact versions, allowing for better version management and more predictable environments.
* Added an empty `components` folder to the create-project template.
* Changed log channel from verbose to notice on SIGINT and SIGTERM on the master process.
* JSHint 2.1.7 -> 2.1.8

### Bugfixes

* When creating a new project through the installer, it would not set up `.gitignore` (more info: [npm issue 2958](https://github.com/isaacs/npm/issues/2958)).
* On iOS prior to version 6, the non-existence of `window.ErrorEvent` would cause an exception in the logger module (Thanks Micky for the fix).


## v0.17.1 - Cabbage Cat

### Minor improvements

* Deserializations in Archivist now catch exceptions gracefully.
* [Plato](https://npmjs.org/package/plato) code complexity reporting has been integrated (`make complexity`).
* [Istanbul](https://npmjs.org/package/istanbul) test coverage reporting has been integrated (`make coverage`).
* The template for new projects integrates Mocha, Istanbul and Plato.
* Automatically running `make setup` inside the game folder has been removed post-install.
* The `Stream_HttpLongPolling` and `Stream_HttpShortPolling` classes have lost their `Stream_` prefixes (lint is happy again).
* Updated JSHint to 2.1.7 (be aware: this changes the config format for predefined globals).
* Made the `schedulerServer.registerTask` user command access level `anonymous`.
* The Command Center has been slightly refactored to make it more maintainable.

### Bugfix

* The creation of apps assumed that there would always be an assetMap and break if there wasn't one.


## v0.17.0 - Five years of Wizcorp celebration release

### File uploads (breaking change)

File uploads through msgServer have been reimplemented. This is visible in three major changes:

- You can upload a FileList object directly (`myForm.myFileInput.files`).
- You can give a `File`, `Blob` or `FileList` regardless of its nesting inside of an object in a user command parameter.
- To upload, you need to wrap your file(s) in a special `Upload` container through one of two APIs.

> Because of these changes, calling a user command that doesn't upload has gotten a free performance
> boost, since no effort has to be made to find File or Blob objects inside the given parameters.

#### API

```javascript
// Transform a single file value into an Upload object.

var file = mage.msgServer.transformUpload(myForm.myFileInput.files[0]);

mage.mymodule.uploadFile(file, cb);


// Transform all client properties (at any nested level) that are files into Upload object.

var obj = {
	name: 'Bob',
	file: myForm.myFileInput.files[0]
};

mage.msgServer.transformEmbeddedUploads(obj);

mage.mymodule.uploadFile(objs, cb);
```

### Asset module (breaking change)

The `changeAsset` API has been updated to benefit from the changes in the file upload API. It's now
a cleaner, easier to understand API, because files are no longer being juggled around. Of course the
asset dashboard also reflects this change.

### Logger

The MAGE logger can now log instances of Node.js's built-in http.IncomingMessage class. That means
that you can serve HTTP requests into the logger's `data(req)` method, and it will yield a friendly
summary of the request, rather than a deep JSON serialization of the entire (rather big) object.

Because of this change, the Bunyan simulator that was introduced in v0.16.0 no longer suppresses the
rather verbose "trace" channel.

### Minor improvements

* The Asset Previewer did not enforce cache eviction, making Chrome's aggressive caching painfully visible (Thanks Micky for the fix).
* Calling `mage.useModules(require, 'already-loaded-module');` on the client no longer aborts the operation, nor will it log an error.

### Bugfixes

* Reintroduced archivist.getReadVault, getWriteVault and added getListVault (missing since v0.15.2).
* Fixed handling of calling `mage.useModules(require, 'non-existing-module');` on the client.


## v0.16.1 - Couch Cat

### Couchbase vault

Archivist has been enriched with support for Couchbase through `libcouchbase`. Read the
[Couchbase vault documentation](./lib/archivist/vaults/couchbase/Readme.md) for more information.

### Logger dashboard

* Major refactoring in both code and styles.
* Muting and unmuting a channel now has an effect on the backlog as well.
* The backlog has been increased in length from 40 to max 500 entries.
* The "m"(aster)/"w"(orker) indicators from the terminal are now also displayed.
* A hard break is rendered when a connection to the server is interrupted, caused for example by a Node.js restart.


## v0.16.0 - Dashboard Cat

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

Enable the dev dashboard by adding the following configuration next to the already existing "cms"
and "support" entries:

```yaml
apps:
    dev:
        responseCache: 10
        access: admin
```

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
- `dev`: the list of apps that should expose this page.

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

### Manta vault

Archivist has been enriched with support for [Manta](http://www.joyent.com/products/manta). Read the
[Manta vault documentation](./lib/archivist/vaults/manta/Readme.md) for more information.

### Logger simulators

The logger has received a new API: `myLogger.simulator(name);`. This will return a fake 3rd party
logger, so other libraries that were hard-wired to a particular library can interface with them.
Currently, we only implemented a simulator for [Bunyan](https://npmjs.org/package/bunyan), because
`node-manta` depended on it. If you ever have to deal with a library that needs a Bunyan logger,
simply feed it the return value of `myLogger.simulator('bunyan');`.

### Sampler

Sampler has been updated to expose a Savvy websocket route at the same route as the normal HTTP
endpoint: `/savvy/sampler`. This will allow nice graphical tools for the dashboard in the future for
all the data you gather with panopticon/sampler.

### Minor improvements

* Dashboard: checkboxes and radiobuttons received a small visual makeover.
* component-builder: bumped to v0.9.0.

### Bugfixes

* Dashboard: table cell alignment in markdown content was not being applied.
* New assets aimed at non-existing folders were not being saved.


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

This proved to fail on some machines, so here is an gawk replacement which also runs a git mv for you:

```bash
ls ./ | gawk '{newName=gensub(/?/,"#","",$0); system("git mv \""$0"\" \""newName"\"")}'
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


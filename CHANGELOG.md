# Changelog

## Next release

Database changes have been made to the gm and gm_data tables. Please run the last ALTER statements in db/changes.sql.
The Makefile in Mithril now has a lot of cool commands. Run "make help" in the Mithril root path to see what it can do!



## v0.6.1, v0.6.2

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

### Logger

The logger's output performance has improved dramatically (x3), by no longer relying on the slow console object, but by
writing directly to stdout/stderr streams.

Also, the logger has been completely rewritten to be more easily configurable. The new configuration looks like this:
`
{
  "logging": {
    "theme": "default",
    "show": ["debug", "info", "error", "time"],
    "hide": ["debug"],
    "output": "terminal"/"file",
    "path": "/var/log/myGame"
  }
}
`
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
{
	properties: {
		loadAll: true
	}
}

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

`
"clientHost": {
	"protocol": "http",
	"transports": {
		"longpolling": { "heartbeat": 120 }
	},
	"bind": { "host": "0.0.0.0", "port": 4242 },
	"expose": { "host": "zombieboss.rk.dev.wizcorp.jp", "port": 4242 }
}
`

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

`exports.params = ['each', 'parameter', 'name'];`

Which is now also reflected in the execute function:

`exports.execute = function (state, each, parameter, name, cb) { ... }`

On the client, this:

`var mod = {}
window.mithril.registerModule('myModule', mod);`

Has changed into:

`var mod = mithril.registerModule($html5client('module.myModule.construct'));`

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
`window.mithril.loader.setup(pages);`


## v0.3.1

Asset maps are now on a per-application basis.

`
// creating an asset map:

var assets = mithril.assets.createAssetMap();

// creating helper functions to register files:

assets.regImg   = assets.regFile.bind(assets, 'img');
assets.regFont  = assets.regFile.bind(assets, 'font');
assets.regAudio = assets.regFile.bind(assets, 'audio');
assets.regHtml  = assets.regFile.bind(assets, 'html');

// adding the asset map to an app's page:

myApp.addPage('myPage', '../../www/pages/myPage', { assetMap: assets });
`

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

`
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
`

### Adding a post processor

`
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
`

### Setting up pages

`
var WebApp = mithril.core.app.web.WebApp;

var gameApp = new WebApp('game', { languages: ['EN'] });
gameApp.setIndexPage('../../www/pages/loader');
gameApp.addPage('landing', '../../www/pages/landing', { assetmap: true });
gameApp.addPage('main', '../../www/pages/main');

var manifest = gameApp.createManifest();
manifest.add('mui://img/ui/spinner');
`

### Configuration options

The "mithrilui" entry has to be completely removed. Renamed the "app" entry to "apps", and make it similar to the following:

`
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
`
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


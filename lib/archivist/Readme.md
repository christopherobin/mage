# Archivist

The archivist rules your data. Its purpose is to help you manage your data,
all through a simple unified API, regardless of which data stores you use.


## Advantages


### Redundant storage

You can configure multiple data stores of the same type, in order to split your data into as many
MySQL databases, couchbase clusters and file systems as you want.

This allows you to write to many stores at once (defined by write-order). It also allows you to
configure a read-order, by which data gets loaded. This is very useful in scenarios like "try
memcached first, else try MySQL".


### Friendly default integration logic with a bunch of database systems

For all built-in data stores, all serialization and access logic is built-in with friendly default
behaviors. That means that you can store into a key/value store like memcached and into an SQL
data store -- through a single API -- without having to program or configure anything specific.


### A solution for static content

The archivist API works equally well for SQL databases, key/value stores and file storage. That
means that it's an out-of-the-box solution for your static content, using an API that is consistent
with how you manage all your other data.


### Highly customizable database integration if needed

Whenever you do want full control over how data gets stored, you have the ability to do so.


### Integration with tomes

Integration with [tomes](https://npmjs.org/package/tomes) is built in. This has a number of specific
advantages.

* No need to tell archivist to store changes, since they are automatically detected.
* Tomes can be transported transparently to and from the browser.


## Terminology


### Topics and Indexes

Each document you store is identified by a topic and an index. Topic is always a string, and
index is always a key/value object. Some typical examples of topic/index pairs could be:

```
topic: "player", index: { actorId: 123 }
topic: "inventory", index: { actorId: "456" }
topic: "cards", index: { actorId: 123, type: "deck" }
```

In SQL terms: consider topic your table, and index your primary key.


### Vaults

Vaults represent the data stores where your data is stored. Each vault type has its own API for
talking to the underlying service, but also exposes a separate `Archive API` that is used internally
to store documents. You generally won't access vaults directly. You can leave that to the archivist.
You will however have to configure them, so that each vault knows where to store data.

The following vault types are currently implemented:

* [File](vaults/file/Readme.md)
* [Memory](vaults/memory/Readme.md)
* [MySQL](vaults/mysql/Readme.md)
* [Memcached](vaults/memcached/Readme.md)
* [Client](vaults/client/Readme.md)

Please read their documentation on how to set them up.


### Archivist

The *archivist* directs your documents to-and-from the vaults. It's your primary point of access,
and provides a simple API for reading and writing data. In MAGE, you can always access it through
`state.archivist`.


### ValueHandlers

ValueHandlers are an API, unique per vault, that implement how values are stored and read. A lot of
this logic is driven around "topics" and "indexes", that these value handlers can translate into
logic that fits the vault in question.

For example, the topic `weapons` with index `{ actorId: 123 }` can be translated into the following
memcached key: `weapons/actorId:123`, or into the following MySQL structure:

```json
{ "table": "weapons", "pk": { "actorId": 123 } }
```

Each vault has friendly defaults, but those can always be overridden with custom logic. For more
information on how to do this, please read "Writing your own ValueHandlers".


### MediaTypes

Each document that is stored, can be stored along with its media type. Think of `image/jpeg`,
`text/plain`, `application/octet-stream`, `application/json`, but also `application/x-tome`.
Media types can be useful in order to recreate a living version of binary- or string-serialized
data. Archivist comes with built-in knowledge of media types and has the ability to convert between
them.

If you want to create a fresh new Tome, you must conjure it, as described in the documentation of
[node-tomes](https://npmjs.org/package/tomes). You may also store other types of data. Tomes are
simply supported out-of-the-box and you are encouraged to use them. You can access the `Tome` class
by requiring it from MAGE by calling:

```javascript
var Tome = mage.require('tomes').Tome;
```


## Quick start guide

To start using archivist in your game, you will have to execute the following steps.


### Configure your vaults

The archivist configuration sits on the root of your config file under the label `archivist`. It
contains 3 child labels:

* `vaults` describes where you store all your data. The keys are the names you give to your vaults.
* `listOrder` is an array with vault names, describing the order in which we list indexes.
* `readOrder` is an array with vault names, describing the order in which we read data.
* `writeOrder` is an array with vault names, describing the order in which we write data.

The vaults entry is a key/value map, where the key is the unique *name* of the vault. It's up to you
to decide on these names. Perhaps often, the name of the vault will match the type of the vault, but
this is absolutely not required. Choose whatever makes sense for your project. The only name that is
reserved is `client`, which is named that way by the MAGE command center. You will want to make
sure that the `client` vault is represented in your `writeOrder`.

It's important to note that the `listOrder`, `readOrder` and `writeOrder` are system-wide. It's
likely that not every topic will be stored on every vault. Whenever we read or write a given topic,
the configured order is traversed, and vaults not linked to the topic are ignored. You cannot change
the ordering for individual topics.

Each vault entry in the configuration has 2 properties: `type` and `config`. The type property is a
fixed ID that is unique for each type of vault. Read the vault documentation referred to in the
*Vaults* section to see these IDs and how to configure vaults of that type.

Example configuration:

```json
{
	"archivist": {
		"vaults": {
			"static": {
				"type": "file",
				"config": { "path": "/tmp" }
			},
			"memcached": {
				"type": "memcached",
				"config": { "servers": ["localhost:11211"], "prefix": "bob/" }
			},
			"mysql": {
				"type": "mysql",
				"config": { "url": "mysql://bob:secret@localhost/bob_game" }
			}
		},
		"listOrder": ["mysql", "static"],
		"readOrder": ["memcached", "mysql", "static"],
		"writeOrder": ["client", "memcached", "mysql", "static"]
	}
}
```


### Configure your topics

In your game's `lib` folder, please create a new folder called `archivist`. This folder will be
`require`d by MAGE's archivist, in order to receive your topic configuration per vault-name.
Consider doing the whole configuration in one file: `lib/archivist/index.js`.

The format is as follows:

```javascript
exports.myTopicName = {
	readOptions: {
	},
	index: ['propName', 'propName'],
	vaults: {
		myVaultName: myValueHandlers
	}
};
```

Where you do this for each topic you want to store in your vaults. The `index` array must be
provided if your topic depends on an index. This array is the signature of the indexes you will
provide when referring to data.

The `readOptions` object may be supplied to overwrite default `options` that are used when reading
from your archivist. The following defaults are defined, and they can be individually replaced:

```json
{
	"mediaTypes": ["application/x-tome", "application/octet-stream"],
	"encodings": ["live"],
	"optional": false
}
```

The `myValueHandlers` object may be replaced with `true` in order to get all default behaviors for
that vault type. Read about "Advanced usage" to see how you can set up these vault handlers with
custom behaviors. In order to keep your configuration maintainable, it makes a lot of sense to
categorize your topics. Imagine for example the following configuration:

```javascript
function dynamicTopic(index) {
	return { index: index, vaults: { mysql: true, memcached: true } };
}

function staticTopic() {
	return { vaults: { file: true } };
}

exports.player = dynamicTopic(['id']);
exports.inventory = dynamicTopic(['playerId']);
exports.cards = dynamicTopic(['playerId']);
exports.cardDefinitions = staticTopic();
exports.itemDefinitions = staticTopic();
```


## Using the Server API

You can always access the archivist through `state.archivist`. If you really need to make your own
instance, you can use the following:

```javascript
var archivist = new mage.core.archivist.Archivist();
```

The following API documentation should tell you how to store, read, delete data and how to set their
expiration time. Keep in mind that there could be vault types that do not support particular
operations. A typical one would be `touch`, which is generally not well supported. But even other
operations may trigger an error. For example, when trying to `write` to a read-only vault, or
opposite.


### Adding new data

```javascript
archivist.add(topic, index, data, mediaType, encoding, expirationTime);
```

Marks the `data` you pass as something you want to store in your vaults, applying the given `topic`
and `index`. If no `mediaType` is given, archivist will try to detect one. If no `encoding` is
given, archivist will try to detect one. If you want to store this data for a limited time, you can
pass an `expirationTime` (unix timestamp in seconds). If a value already existed, you should expect
this call to fail.


### Getting data

```javascript
archivist.get(topic, index, options, function (error, data) { });
```

Reads data from all vaults configured for this topic, returning the first successful read. Read
errors are considered fatal, and you should abort your operations. However, if a vault is responsive
but simply doesn't hold the value you requested, the next vault in line may still be able to deliver.
If a value has already been read or written to before in this archivist instance, that value has
been cached and will be returned.

The following options are available to you:

* `optional`: (boolean, default: false) Indicates whether it's considered an error if data is not found in any of the vaults.
* `mediaTypes`: (array, default: `['application/x-tome', 'application/octet-stream']`) Indicates that you only accept these media types, in the given order of priority. If data of another media type is read, a conversion attempt will be made (eg: JSON to Tome).
* `encodings`: (array, default: `['live']`) Indicates that you only accept these encodings, in the given order of priority. If data of another encoding is read, a conversion attempt will be made (eg: JavaScript object to utf8 JSON).
* `encodingOptions`: (object, default: undefined) Options to be passed to the encoders. The JavaScript object to utf8 JSON encoder for example, accepts: `{ pretty: true }`, to trigger indented JSON stringification.

This options object is not required, and your callback may be passed as the third argument.


#### Multi-get

```javascript
archivist.mget(queries, options, function (error, multiData) { });
```

For multi-get operations, please use `mget`. The options are identical to and just as optional as in
the `get` method. There are two supported `queries` formats: the array and the map. In both cases,
the result will map to the input.

##### Array style queries

###### queries

```json
[
	{ "topic": "players", "index": { "id": "abc" } },
	{ "topic": "players", "index": { "id": "def" } },
	{ "topic": "players", "index": { "id": "hij" } }
]
```

###### multiData

The result is an array where the output order matches the input order:
```json
[
	{ "name": "Bob" },
	undefined,
	{ "name": "Harry" }
]
```

##### Object map style queries

###### queries

```json
{
	"a": { "topic": "players", "index": { "id": "abc" } },
	"b": { "topic": "players", "index": { "id": "def" } },
	"c": { "topic": "players", "index": { "id": "hij" } }
}
```

###### multiData

The result is an object map where the keys match the input keys:
```json
{
	"a": { "name": "Bob" },
	"b": undefined,
	"c": { "name": "Harry" }
}
```


### Overwriting data

```javascript
archivist.set(topic, index, data, mediaType, encoding, expirationTime);
```

Marks the `data` you pass as something you want to write to all your vaults, applying the given
`topic` and `index`. If no `mediaType` is given, archivist will apply the one it already knows
about this value (if a `get` or `add` happened before), else it will try to detect one. If no
`encoding` is given, archivist will try to detect one. If you want to store this data for a limited
time, you can pass an `expirationTime` (unix timestamp).

If a vault allows for diff-logic to occur, and the data passed allows diffs to be read, this will be
used.

For certain types of data, like Tomes, you do not have to call this function. Whenever you change
a Tome's contents, it will call `set` automatically for you.


### Deleting data

```javascript
archivist.del(topic, index);
```

Marks data pointed to by `topic` and `index` as something you want to delete. A subsequent `get`
will not yield any data.


### Setting an expiration time

```javascript
archivist.touch(topic, index, expirationTime);
```

Marks data with a new expiration time (unix timestamp in seconds).


### Finding data

```javascript
archivist.list(topic, partialIndex, options, function (error, arrayOfIndexes) { });
```

Returns an array of indexes on the given topic matching the partial index you provide. The options
object is not required, and your callback may be passed as the third argument. You can, for example,
query for all players in the game by calling:

```javascript
archivist.list('player', {}, function (error, indexes) {
	/* indexes is now [{ id: 5 }, { id: 20 }, ...] */
});
```

You may pass the following options:

**sort**

An array of sorting rules. Each rule has the format:
```json
{ "name": "fieldName in the index", "direction": "asc or desc" }
```

You may give multiple of these in order of importance. Use `direction` to specify ascending or
descending sort-order.

**chunk**

An array of the format `[start, length]` where both values are integers and `length` is optional.
This will limit the sorted result to the indexes starting at `start` (counts from 0) until
`start + length`. This allows for paginating your results.

Options example (sorted by id (descending), page 3 with 10 results per page):
```json
{
	"sort": [{ "name": "id", "direction": "desc" }],
	"chunk": [20, 10]
}
```


### Distributing changes to all vaults

```javascript
archivist.distribute(function (error) { });
```

This takes all the queued up operations (add, set, del, touch) and executes them on each of
the relevant vaults. This distribution is automatically done by the `state` object in MAGE when it
closes without errors, so you should never have to call this yourself.


## Client API

The archivist is exposed on the browser through a MAGE module called "archivist". You can use it
like any other built-in module:

```javascript
mage.useModules(request, 'archivist');
```

You can now read from the vaults by calling using the APIs described in the following paragraphs.
Of course it goes without saying that you should be careful not to expose user commands to games
that can mutate data directly. You will want to limit the game's access to the `get` API. Tools
however will benefit from the other methods.


### Creating data

```javascript
archivist.add(topic, index, data, mediaType, encoding, expirationTime, function (error) { });
```

Calls into the server archivist's `add` method. The arguments are identical. Once the data has been
created, it will stay in the client's caches. A `get` will immediately return with the created data.


### Overwriting data

```javascript
archivist.set(topic, index, data, mediaType, encoding, expirationTime, function (error) { });
```

Calls into the server archivist's `set` method. The arguments are identical. Once the data has been
written, it will stay in the client's caches. A `get` will immediately return with the new data.


### Getting data

```javascript
archivist.get(topic, index, options, function (error, data) { });
```

```javascript
archivist.mget(queries, options, function (error, data) { });
```

Call into the server archivist's `get` and `mget` method. The arguments are identical. If any of the
data is already available in the client's caches, it will be returned to the callback immediately
without hitting the server.


### Setting the expiration time

```javascript
archivist.touch(topic, index, expirationTime, function (error) { });
```

Calls into the server archivist's touch method. The arguments are identical. If the data is
available on the client's caches, that data's expiration time is also updated.


### Deleting data

```javascript
archivist.del(topic, index, function (error) { });
```

Calls into the server archivist's del method. The arguments are identical. If the data is
available on the client's caches, it will be removed there too.


### Applying a diff to data

```javascript
archivist.applyDiff(topic, index, diff, function (error) { });
```

For data types that support diff-updates (like Tomes), this will allow you to send the diff and
expect the data to be updated on the server side.


### Finding data

```javascript
archivist.list(topic, partialIndex, options, function (error, indexes) { });
```

Calls into the server archivist's list method. The arguments are identical.


## Advanced vault usage


### Direct access to a vault's native API

If you want to access vault directly, you can ask the archivist for the instance. If you want to
write data, you can call `archivist.getWriteVault(vaultName)`. A vault you want to read from can
be requested by calling `archivist.getReadVault(vaultName)`. For more information on the APIs
exposed by each vault, please refer to their documentation.


### Writing your own ValueHandlers

Value handlers are a collection of APIs that enable a vault to get data to and from its underlying
data store. The total set of APIs is limited, and each vault type has its own required subset. For
more information on the specifics per vault type, please refer to their documentation.

You can integrate these in the way explained in the "Configure your topics" paragraph. Keep in mind
that whenever you choose to implement one of the APIs for a topic, the non-implemented ones will
still exist in their default implementations.

The following APIs can be implemented.


#### Serializing data

The serialize method receives a `VaultValue` instance which can contain data, in an `encoding`,
tagged with a `MediaType` and aware of its `topic` and `index`. When preparing data to be stored
into a vault, the serialize method may have to change the encoding to better fit the requirements of
the vault, and even return completely different/altered data (imagine prepending header/meta
information to the real data). Finally, the returned data is used by the vault.

Example:
```javascript
function serialize(value) {
	return value.setEncoding(['utf8', 'buffer']).data;
}
```


#### Deserializing data

The deserialize method receives the data as it was returned by the vault. It has the duty to
initialize the passed `VaultValue` instance with that data, in the right `encoding` and `MediaType`.
If encoding and/or MediaType are omitted, they will be guessed by the underlying system. This can be
acceptable when the data is returned in deserialized form by the vault.

Example:
```javascript
function deserialize(data, value) {
	value.initWithData(null, data, null);
}
```


#### Generating a key

Every vault needs a key function to access data. Generally, the key function will take the `topic`
and `index` and turn those into something that is appropriate for the vault. This can be a string
(eg. in the case of memcached), but also a rich object (eg. in the case of MySQL). Think of the key
as the minimal information required to find a piece of data in a vault.

Example (typical SQL):
```javascript
function key(topic, index) {
	return {
		table: topic,  // topic is used as the table name
		pk: index      // { columnName: value }
	};
}
```


#### Selecting a shard

The shard method is similar to the key method, except it doesn't pinpoint the exact location of
data, but a general location, in order to facilitate sharding. A good example is the Client vault,
which needs to emit data changes to different users based on certain very specific information.
Incidentally, this is currently the *only* ValueHandler method you *have to* implement yourself.

Example (Client):
```javascript
function shard(value) {
	// the Client shard is one or more actor IDs

	return value.index.actorId;
}
```

Example (Client, multiple actors):
```javascript
function shard(value) {
	// the Client shard is one or more actor IDs

	value.setEncoding('live');

	return [value.index.actorId].concat(value.data.friendIds);
}
```

Example (Client, static data for all actors):
```javascript
function shard(value) {
	return true;
}
```


### How to manipulate a VaultValue

TODO

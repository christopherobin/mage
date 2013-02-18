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
* [File](vaults/file/README.md)
* [MySQL](vaults/mysql/README.md)
* [Memcached](vaults/memcached/README.md)
* [MAGE Client](vaults/mage-client/README.md)

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
* `readOrder` is an array with vault names, describing the order in which we read data.
* `writeOrder` is an array with vault names, describing the order in which we write data.

The vaults entry is a key/value map, where the key is the unique *name* of the vault. It's up to you
to decide on these names. Perhaps often, the name of the vault will match the type of the vault, but
this is absolutely not required. Choose whatever makes sense for your project. The only name that is
reserved is `mage-client`, which is named that way by the MAGE command center. You will want to make
sure that the `mage-client` vault is represented in your `writeOrder`.

It's important to note that both the `readOrder` and `writeOrder` are system-wide. It's likely that
not every topic will be stored on every vault. Whenever we read or write a given topic, the
configured order is traversed, and vaults not linked to the topic are ignored. You cannot change
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
                "readOrder": ["memcached", "mysql", "static"],
                "writeOrder": ["mage-client", "memcached", "mysql", "static"]
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
	myVaultName: myValueHandlers
};
```

Where you do this for each topic you want to store in your vaults. The `myValueHandlers` object is
optional, and may be left `null` or `undefined`. Read about "Advanced usage" to see how you can
set up these vault handlers. In order to keep your configuration maintainable, it makes a lot of
sense to categorize your topics. Imagine for example the following configuration:

```javascript
var dynamicVaults = { mysql: true, memcached: true };
var staticVaults = { file: true };

exports.player = dynamicVaults;
exports.inventory = dynamicVaults;
exports.cards = dynamicVaults;
exports.cardDefinitions = staticVaults;
exports.itemDefinitions = staticVaults;
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


### `archivist.create(topic, index, data[, mediaType, encoding, expirationTime])`

Marks the `data` you pass as something you want to store in your vaults, applying the given `topic`
and `index`. If no `mediaType` is given, archivist will try to detect one. If no `encoding` is
given, archivist will try to detect one. If you want to store this data for a limited time, you can
pass an `expirationTime` (unix timestamp in seconds). If a value already existed, you should expect
it to be overwritten.


### `archivist.read(topic, index[, options], callback)`

Reads data from all vaults configured for this topic, returning the first successful read. The
callback receives two arguments: `(error, data)`. Read errors are considered fatal, and you should
abort your operations. However, a read failure on a single vault doesn't have to be fatal if the
next vault in line can still deliver. If a value has already been read or created before in this
archivist instance, that value has been cached and will be returned.

The following options are available to you:

*`optional` (boolean, default: false)*
Indicates whether it's considered an error if data is not found in any of the vaults.

*`mediaTypes` (array, default: `['application/x-tome', 'application/octet-stream']`)*
Indicates that you only accept these media types, in the given order of priority. If data of another
media type is read, a conversion attempt will be made (eg: JSON to Tome).

*`encodings` (array, default: `['live']`)*
Indicates that you only accept these encodings, in the given order of priority. If data of another
encoding is read, a conversion attempt will be made (eg: JavaScript object to utf8 JSON).

*`encodingOptions` (object, default: undefined)*
Options to be passed to the encoders. The JavaScript object to utf8 JSON encoder for example,
accepts: `{ pretty: true }`, to trigger indented JSON stringification.

The options object is not required, and your callback may be passed as the third argument.


### `archivist.update(topic, index, data[, mediaType, encoding, expirationTime])`

Marks the `data` you pass as something you want to overwrite in your vaults, applying the given
`topic` and `index`. If no `mediaType` is given, archivist will apply the one it already knows
about this value (if a read happened before), else it will try to detect one. If no `encoding` is
given, archivist will try to detect one. If you want to store this data for a limited time, you can
pass an `expirationTime` (unix timestamp).

If a vault allows for diff-logic to occur, and the data passed allows diffs to be read, this will be
used.

For certain types of data, like Tomes, you do not have to call this function. Whenever you change
a Tome's contents, it will call `update` automatically.


### `archivist.del(topic, index)`

Marks data pointed to by `topic` and `index` as something you want to delete. A subsequent read will
fail.


### `archivist.touch(topic, index, expirationTime)`

Marks data with a new expiration time (unix timestamp in seconds).


### `archivist.distribute(callback)`

This takes all the queued up operations (create, update, del, touch) and executes them on each of
the relevant vaults. This distribution is automatically done by the `state` object in MAGE when it
closes without errors, so you should never have to call this yourself.


## Client API

The archivist is exposed on the browser through a MAGE module called "archivist". You can use it
like any other built-in module by running the following snippet in your game's bootstrap file:
```javascript
mage.useModule('archivist');
```

On the client side, like with any other module, please build it with:
```javascript
$html5client('module.archivist');
```

You can now read from the vaults by calling using the APIs described in the following paragraphs.
Of course it goes without saying that you should be careful not to expose user commands to games
that can mutate data directly. You will want to limit the game's access to the `read` API. Tools
however will benefit from the other methods.


### `archivist.read(topic, index, options, cb)`

Calls into the server archivist's read method. The arguments are identical. If the data is already
available on the client's caches, it will be returned to the callback immediately without hitting
the server.


### `archivist.create(topic, index, data, mediaType, encoding, expirationTime, cb)`

Calls into the server archivist's create method. The arguments are identical. Once the data has been
created, it will stay in the client's caches. A read will immediately return with the created data.


### `archivist.touch(topic, index, expirationTime, cb)`

Calls into the server archivist's touch method. The arguments are identical. If the data is
available on the client's caches, that data's expiration time is also updated.


### `archivist.del(topic, index, cb)`

Calls into the server archivist's del method. The arguments are identical. If the data is
available on the client's caches, it will be removed there too.


### `archivist.applyDiff(topic, index, diff, cb)`

For data types that support diff-updates (like Tomes), this will allow you to send the diff and
expect the data to be updated on the server side.


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


#### `serialize(value)`

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


#### `deserialize(data, value)`

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


#### `key(value)`

Every vault needs a key function to access data. Generally, the key function will take the `topic`
and `index` from the passed `VaultValue` and turn those into something that is appropriate for the
vault. This can be a string (eg. in the case of memcached), but also a rich object (eg. in the case
of MySQL). Think of the key as the minimal information required to find a piece of data in a vault.

Example (typical SQL):
```javascript
function key(value) {
	return {
		table: value.topic,  // topic is used as the table name
		pk: value.index      // { columnName: value }
	};
}
```


#### `shard(value)`

The shard method is similar to the key method, except it doesn't pinpoint the exact location of
data, but a general location, in order to facilitate sharding. A good example is the MAGE Client
vault, which needs to emit data changes to different users based on certain very specific
information. Incidentally, this is currently the *only* ValueHandler method you *have to*
implement yourself.

Example (MAGE Client):
```javascript
function shard(value) {
	// the MAGE Client shard is one or more actor IDs

	return value.index.actorId;
}
```

Example (MAGE Client, multiple actors):
```javascript
function shard(value) {
	// the MAGE Client shard is one or more actor IDs

	value.setEncoding('live');

	return [value.index.actorId].concat(value.data.friendIds);
}
```


### How to manipulate a VaultValue

TODO

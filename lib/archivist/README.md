# Archivist

The archivist rules your data. Its purpose is to help you manage your data,
all through a simple unified API, regardless of which data stores you use.


## Advantages

### Redundant storage

Each data store is represented by a "vault". You can configure multiple
vaults of the same time, in order to split your data into as many
MySQL databases, couchbase clusters and file systems as you want.

This allows you to write to many stores at once (defined by write-order).
It also allows you to configure a read-order, by which data gets loaded.
This is very useful in scenarios like "try memcached first, else try
MySQL".

### Friendly default integration logic with a bunch of database systems

For all built-in vaults, all serialization and access logic is built-in with friendly default
behaviors. That means that you can store into a key/value store like memcached and into an SQL
data store -- through a single API -- without having to program or configure anything specific.

### A solution for static content

The archivist API works equally well for SQL databases, key/value stores and file storage. That
means that it's an out-of-the-box solution for your static content, using an API that is consistent
with how you manage all your other data.

### Highly customizable integration if needed

Whenever you do want full control over how data gets stored into the vaults, you can take control.

### Integration with tomes

Integration with [tomes](https://npmjs.org/package/tomes) is built in. This
has a number of specific advantages.

* No need to tell archivist to store changes, since they are automatically detected.
* Tomes can be transported transparently to and from the browser.


## Built-in vault types

### mage-client (for synchronizing to browser)

This vault is used to send updates to the player, so that their data is always synchronized in
real time. This vault is always created when the execution of a user command starts. It requires no
configuration.


### mysql (node-mysql)

The node-mysql module is supported through the built-in "mysql" vault type. Its configuration is:
```json
{
	"type": "mysql",
	"config": {
		"uri": "mysql uri as described in the node-mysql readme"
	}
}
```

This URI format is documented in the [node-mysql readme](https://npmjs.org/package/mysql).


### memcached (node-memcached)

The node-memcached module is supported through the built-in "memcached" vault type. Its
configuration is:
```json
{
	"type": "memcached",
	"config": {
		"servers": ["a servers array", "or object"],
		"options": { "options": "to pass to node-memcached" },
		"prefix": "prefix for all your keys"
	}
}
```

The `servers` and `options` objects are described in the
[node-memcached readme](https://npmjs.org/package/memcached).
Both `options` and `prefix` are optional.


### file (Node.js built-in "fs"-module)

For static content, it often makes a lot of sense to store your files on disk, in your repository.
The "file" vault makes this possible. You can configure it like this:

```json
{
	"type": "file",
	"config": { "path": "/tmp" }
}
```


## Server API



## Client API



## Quick start guide

To start using archivist in your game, you will have to execute the following steps.

### Configure your vaults

The archivist configuration sits on the root of your config file under the label `archivist`. It
contains 3 child labels:

* `vaults` describes where you store all your data.
* `readOrder` is an array with vault names, describing the order in which we read data.
* `writeOrder` is an array with vault names, describing the order in which we write data.




```json
{
        "archivist": {
                "vaults": {
                        "static": { "type": "file", "config": { "path": "/tmp" } },
                        "memcached": { "type": "memcached", "config": { "servers": ["localhost:11211"], "prefix": "bob/" } },
                        "mysql": { "type": "mysql", "config": { "uri": "mysql://bob:secret@localhost/bob_game" } }
                },
                "readOrder": ["memcached", "mysql", "static"],
                "writeOrder": ["mage-client", "memcached", "mysql", "static"]
        }
}
```




## How to use archivist






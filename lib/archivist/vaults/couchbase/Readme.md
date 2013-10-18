# Couchbase vault

The [node-couchbase](https://npmjs.org/package/couchbase) module is supported through the built-in
"couchbase" vault type. It supports sharding by creating hashes on strings that your `shard`
function may provide.

Alternatively, you can also use the [Memcached vault](../memcached/Readme.md) which is based on
[node-memcached](https://npmjs.org/package/memcached).

## Configuration

```json
{
	"type": "couchbase",
	"config": {
		"options": { "options to pass": "to node-couchbase" },
		"prefix": "prefix for all your keys"
	}
}
```

The `options` object may be empty, but may contain any of the following:

```json
{
	"user": "Administrator",
	"password": "password",
	"host": [ "localhost:8091" ],
	"bucket": "default"
}
```

Keep in mind that `user` and `password` are not required for normal query operations.

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `couchbase.get()`
add       | ✔         | `couchbase.add()`
set       | ✔         | `couchbase.set()`
touch     | ✔         | `couchbase.touch()`
del       | ✔         | `couchbase.remove()`

## Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | "topic/indexProp:indexValue/indexProp:indexValue/..." (index is sorted)
`serialize(value)`         |          | forced to `live` encoding, node-couchbase will serialize and flag type
`deserialize(data, value)` |          | received in `live` encoding

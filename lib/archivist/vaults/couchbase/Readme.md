# Couchbase vault

The node-couchbase module is supported through the built-in "couchbase" vault type. It supports
sharding by creating hashes on strings that your `shard` function may provide.

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
	"debug": false,
	"user": "Administrator",
	"password": "password",
	"hosts": [ "localhost:8091" ],
	"bucket": "default"
}
```

Keep in mind that `user` and `password` are not required for normal query operations.

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | no        |
get       | yes       | `couchbase.get()`
add       | yes       | `couchbase.add()`
set       | yes       | `couchbase.set()`
touch     | yes       | `couchbase.touch()`
del       | yes       | `couchbase.remove()`

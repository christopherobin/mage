# Memcached vault

The node-memcached module is supported through the built-in "memcached" vault type.

## Configuration

```json
{
	"type": "memcached",
	"config": {
		"servers": ["a servers array", "or object"],
		"options": { "options to pass": "to node-memcached" },
		"prefix": "prefix for all your keys"
	}
}
```

The `servers` and `options` objects are described in the
[node-memcached readme](https://npmjs.org/package/memcached). Both `options` and `prefix` are
optional.

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `memcached.get()`
add       | ✔         | `memcached.add()`
set       | ✔         | `memcached.set()`
touch     | ✔         | `memcached.touch()`
del       | ✔         | `memcached.del()`

## Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | "topic/indexProp:indexValue/indexProp:indexValue/..." (index is sorted)
`serialize(value)`         |          | forced to `live` encoding, node-memcached will serialize and flag type
`deserialize(data, value)` |          | received in `live` encoding

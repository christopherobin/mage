# Memcached vault

The node-memcached module is supported through the built-in "memcached" vault type. Its
configuration is:
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

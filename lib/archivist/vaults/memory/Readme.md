# Memory vault

For static content, it often makes a lot of sense to keep your files in memory for quick access.
The "memory" vault makes this possible. The Memory vault keeps data serialized in memory. That
allows synchronization to clients to happen without any (de)serialization steps, saving you precious
CPU and garbage collection cycles.

## Configuration

```json
{
	"type": "memory"
}
```

The memory vault doesn't use any special configuration.

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | yes       | `for (var trueName in cache) { }`
get       | yes       | `deserialize(cache[trueName(fullIndex, topic)])`
add       | yes       | `cache[trueName(fullIndex, topic)] = serialize(data)`
set       | yes       | `cache[trueName(fullIndex, topic)] = serialize(data)`
touch     | yes       | `setTimeout()`
del       | yes       | `delete cache[trueName(fullIndex, topic)]`

# Memory vault

For static content, it often makes a lot of sense to keep your files in memory for quick access.
The "memory" vault makes this possible. The Memory vault keeps data serialized in memory. That
allows synchronization to clients to happen without any (de)serialization steps, saving you precious
CPU and garbage collection cycles. You can configure the memory vault like this:

```json
{
	"type": "memory"
}
```

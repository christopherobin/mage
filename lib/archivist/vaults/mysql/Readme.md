# MySQL vault

The node-mysql module is supported through the built-in "mysql" vault type.

## Configuration

```json
{
	"type": "mysql",
	"config": {
		"url": "mysql url as described in the node-mysql readme"
	}
}
```

This URL format is documented in the [node-mysql readme](https://npmjs.org/package/mysql).

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `SELECT FROM table WHERE partialIndex`
get       | ✔         | `SELECT FROM table WHERE fullIndex`
add       | ✔         | `INSERT INTO table SET ?`
set       | ✔         | `INSERT INTO table SET ? ON DUPLICATE KEY UPDATE ?`
touch     |           |
del       | ✔         | `DELETE FROM table WHERE fullIndex`

## Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | `{ table: topic, pk: index }`
`parseKey(mysqlKey)`       |          | `{ topic: key.table, index: key.pk }`
`serialize(value)`         |          | `{ value: utf8orBufferFromValue, mediaType: value.mediaType }`
`deserialize(data, value)` |          | parses row.value and row.mediaType into Value

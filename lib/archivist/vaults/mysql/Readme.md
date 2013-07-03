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
list      | yes       | `SELECT FROM table WHERE partialIndex`
get       | yes       | `SELECT FROM table WHERE fullIndex`
add       | yes       | `INSERT INTO table SET ?`
set       | yes       | `INSERT INTO table SET ? ON DUPLICATE KEY UPDATE ?`
touch     | no        |
del       | yes       | `DELETE FROM table WHERE fullIndex`

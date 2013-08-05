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


## How to set up your MySQL tables

Queries against your database are done through a combination of the generated keys and serialized
values. A generated key must yield a table name and a primary key. A serialized value must yield a
number of column names with their respective values.

The default topic API that comes with this vault behaves as can seen in the table above. This means
that for example, given a topic `people` and index `{ personId: 1 }`, the following table should
exist:

```sql
CREATE TABLE people (
  personId INT UNSIGNED NOT NULL,
  value SMALLTEXT NOT NULL,
  mediaType VARCHAR(255) NOT NULL,
  PRIMARY KEY(personId)
) ENGINE=InnoDB;
```

> Please note that you should probably change column types, as this is really just an example.
> Also keep in mind character sets (utf8_bin is usually a good choice) and data type ranges.

If you want to change how this information is stored, by adding columns, etc, you can overload the
serializer method to do so. For example, consider the following example if you want to add a
timestamp to a `lastChanged INT UNSIGNED NOT NULL` column.

```javascript
exports.people.vaults.mysql.serialize = function (value) {
	return {
		value: value.setEncoding(['utf8', 'buffer']).data,
		mediaType: value.mediaType,
		lastChanged: parseInt(Date.now() / 1000)
	};
};
```

# SQLite vault

The node-sqlite3 module is supported through the built-in "sqlite3" vault type.
This vault should really only be used for development and testing. Be forwarned.
Further documenation can be found at [node-sqlite3](https://github.com/mapbox/node-sqlite3).


## Configuration

### URL based config
```yaml
		sqlite:
			type: sqlite
			config:
				filename: "/home/vagrant/awesomegame/sqlitevault/awesomegame.db"
```

If no filename is provided, an in memory db will be created that will be destroyed upon end of connection.
If an empty string is provided, an temporary db stored on disk will be created and destroyed upon end of connection.


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


## Bootstrapping a database

This is supported through the `./game archivist-create` CLI command. This will create your empty
database. Tables must be created through migration scripts. Running `./game archivist-drop` will
drop the entire database.


## Schema migrations

Archivist allows for [schema migrations](../../SchemaMigrations.md), and the SQLite vault supports
this.


## How to set up your SQLite tables

Queries against your database are done through a combination of the generated keys and serialized
values. A generated key must yield a table name and a primary key. A serialized value must yield a
number of column names with their respective values.

The default topic API that comes with this vault behaves as can seen in the table above. This means
that for example, given a topic `people` and index `{ personId: 1 }`, the following table should
exist:

```sql
CREATE TABLE people (
  personId INT UNSIGNED NOT NULL,
  value TEXT NOT NULL,
  mediaType VARCHAR(255) NOT NULL,
  PRIMARY KEY (personId)
);
```

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

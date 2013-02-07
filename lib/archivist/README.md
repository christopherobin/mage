# Archivist

The archivist rules your data. Its purpose is to help you manage your data,
all through a simple unified API, regardless of which data stores you use.


## Advantages

### Redundant storage

Each data store is represented by a "vault". You can configure multiple
vaults of the same time, in order to split your data into as many
MySQL databases, couchbase clusters and file systems as you want.

This allows you to write to many stores at once (defined by write-order).
It also allows you to configure a read-order, by which data gets loaded.
This is very useful in scenarios like "try memcached first, else try
MySQL".

### Friendly default integration logic with a bunch of database systems

For all built-in vaults, all serialization and access logic is built-in with friendly default
behaviors. That means that you can store into a key/value store like memcached and into an SQL
data store -- through a single API -- without having to program or configure anything specific.

### Highly customizable integration if needed

Whenever you do want full control over how data gets stored into the vaults, you can take control.

### Integration with tomes

Integration with [tomes](https://npmjs.org/package/tomes) is built in. This
has a number of specific advantages.

* No need to tell archivist to store changes, since they are automatically detected.
* Tomes can be transported transparently to and from the browser.


## Quick start guide







## How to use archivist






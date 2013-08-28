# DynamoDB vault

Excerpt from Amazon:

`Amazon DynamoDB is a fully managed NoSQL database service that provides fast and predictable
performance with seamless scalability. If you are a developer, you can use Amazon DynamoDB to
create a database table that can store and retrieve any amount of data, and serve any level of
request traffic. Amazon DynamoDB automatically spreads the data and traffic for the table over
a sufficient number of servers to handle the request capacity specified by the customer and the
amount of data stored, while maintaining consistent and fast performance. All data items are stored
on Solid State Disks (SSDs) and are automatically replicated across multiple Availability Zones
in a Region to provide built-in high availability and data durability.`


## Configuration

```json
{
    "type": "dynamodb",
    "config": {
        "accessKeyId": "The access ID provided by Amazon",
        "secretAccessKey": "The secret ID provided by Amazon",
        "region": "A valid region, refers to the Amazon doc for that or ask your sysadmin, asia is ap-northeast-1"
}
```

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `DynamoDB.getItem`
add       | ✔         | `DynamoDB.putItem` with `Expect.exists = false` set to the index keys
set       | ✔         | `DynamoDB.putItem`
touch     |           |
del       | ✔         | `DynamoDB.deleteItem`


## Required Topic API

signature                      | required | default implementation
-------------------------------|----------|-----------------------
`createKey(index)`             |          | `{ index1: { 'S': 'value1' }, index2: ... }`
`serialize(value)`             |          | `{ data: { 'S': utf8FromValue }, mediaType: { 'S': value.mediaType } }`
`deserialize(data, value)`     |          | parses row.data and row.mediaType into Value
`createExpect(keys, exists)`   |          | `{ key1: { 'Exists': exists }, key2: { ... } }`
`transformError(value, error)` |          | `if (error.code === knownError) return new Error('Comprehensive message')`


## How to set up your DynamoDB tables

The default driver expects a table with a basic HashKey and optional RangeKey both set as strings, it will then store
data serialized in 2 columns named data and mediaType.

If you need to explicitly unpack your data in multiple columns, you will need to override serialize and deserialize like
in the following example:

```javascript
exports.people.vaults.dynamodb.serialize = function (value) {
    // serialize the primary keys as usual
    var res = this.createKey(value.index);

    // store manually in each column
    res.fullName = { 'S': value.data.fullName };
    res.email = { 'S': value.data.email };
    // AWS requires everything to be strings, even numbers, when sent through their API
    res.age = { 'N': value.data.age.toString() };
    res.interests = { 'SS': value.data.interests };

    return res;
};

// make sure to override deserialize too!
exports.people.vaules.dynamodb.deserialize = function (data, value) {
    // just read data from DynamoDB, you may need to do some type conversions manually
    value.setData(null, {
        fullName: data.fullName.S,
        email: data.email.S,
        age: parseInt(data.age.N),
        interests: data.interests.SS
    });
}
```

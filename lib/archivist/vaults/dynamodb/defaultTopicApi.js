/**
 * Serialize data for storage in DynamoDB, data is serialized to 2 columns data and mediaType for easy storage, if you
 * need more control you may override that topic function to split your data properly in multi-columns
 *
 * @param {VaultValue} value The value to serialize
 * @returns {Object} An item object for usage in DynamoDB.putItem
 */
exports.serialize = function (value) {
	// serialize data
	var res = this.createKey(value.index);

	// just put the encoded data as is in the DB
	res.data = { 'S': value.setEncoding(['utf8']).data };

	// store media type too
	res.mediaType = { 'S': value.mediaType };

	return res;
};

/**
 * Read data back from the table, if you overrided the serialize method, this is where you should transform it back to
 * a VaultValue
 *
 * @param {Object}     data  The Item from the database
 * @param {VaultValue} value The VaultValue where we want to deserialize stuff
 */
exports.deserialize = function (data, value) {
	// just deserialize stuff
	value.setData(data.mediaType.S, data.data.S, 'utf8');
};

/**
 * Transforms index values into a key object for DynamoDB.getItem, if you want to uses special indexes, this is where
 * you need to implement them, serialize will use that method to generate the data object provided to putItem.
 *
 * @param {Object} index An object in the form {index1: value1, index2: ...}
 * @returns {Object}
 */
exports.createKey = function (index) {
	var res = {};

	// iterate on each index
	for (var i = 0; i < this.index.length; i++) {
		var key = this.index[i];

		if (index[key] === undefined) {
			throw new Error('Missing index ' + key);
		}

		res[key] = { 'S': index[key].toString() };
	}

	return res;
};

/**
 * Create an expect block for the Amazon DynamoDB API
 *
 * @param {string[]} keys   A list of attributes we want to check about
 * @param {boolean}  exists Whether we want them to exists or not
 * @return {Object} An Expect structure
 */
exports.createExpect = function (keys, exists) {
	var res = {};

	// iterate on each index
	for (var i = 0; i < keys.length; i++) {
		res[keys[i]] = {
			Exists: exists
		};
	}

	return res;
};

/**
 * Defaults errors returned by AWS are not really developer friendly so we convert them to something easier to parse.
 * If you need to capture the raw errors, feel free to override/extend that method with a noop or similar.
 *
 * Possible exceptions from AWS:
 * - *ProvisionedThroughputExceededException*: Raised when you exceed the configured throughput during a batchGetItem
 * - *ValidationException*:                    Thrown when invalid data is provided to batchWriteItem
 * - *ThrottlingException*:                    Thrown when you exceed the amount of reads or writes per second
 *                                             configured for your table
 * - *ConditionalCheckFailedException*:        Thrown when a conditional check (such as when using the Expected flag
 *                                             when writing stuff) fails
 * - *ResourceInUseException*:                 A table is currently being created or updated and cannot be accessed
 * - *ResourceNotFoundException*:              Raised when a table doesn't exists
 *
 * @param {Object} value The value provided to the original archivist method
 * @param {Error} error The error object
 */
exports.transformError = function (value, error) {
	if (!error) {
		return null;
	}

	switch (error.code) {
	// happens when trying to access a non existing table
	case 'ResourceNotFoundException':
		return new Error('Table ' + value.topic + ' does not exists on DynamoDB, please run migration scripts or create it');
	// when using archivist, that one will happen only on duplicate entries
	case 'ConditionalCheckFailedException':
		return new Error('Duplicate entry in table ' + value.topic);
	}

	return error;
};
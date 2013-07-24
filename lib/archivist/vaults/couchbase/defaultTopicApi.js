/**
 * Serializer for VaultValues for CouchbaseVault instances
 *
 * @param   {VaultValue} value The VaultValue to serialize
 * @returns {VaultValue.data}  Live encoded data
 */

exports.serialize = function (value) {
	// throws exceptions on failure

	return value.setEncoding(['live']).data;
};


/**
 * Deserializer for populating VaultValues from a CouchbaseVault
 *
 * @param {*}          data  The data received from Couchbase
 * @param {VaultValue} value The VaultValue to populate
 */

exports.deserialize = function (data, value) {
	// let mediaType be detected by the VaultValue

	value.setData(null, data, 'live');
};


/**
 * Creates a key from a topic and an index
 *
 * @param {string} topic The topic to target
 * @param {Object} index The index to target
 * @returns {string}     The generated key
 */

exports.createKey = function (topic, index) {
	// eg: weapons/actorId:123/bag:main
	// eg: weapons/guildId:123

	var key = topic + '', props, i;

	if (index) {
		props = Object.keys(index);
		props.sort();

		for (i = 0; i < props.length; i++) {
			key += '/' + props[i] + ':' + index[props[i]];
		}
	}

	return key;
};

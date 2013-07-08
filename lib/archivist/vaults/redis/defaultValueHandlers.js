exports.serialize = function (value) {
	// throws exceptions on failure

	// the header is:
	// - 2 bytes to indicate JSON-length in bytes (65535 max header length)
	// - JSON containing: { mediaType: "a/b" }
	// - a single byte "\n" delimiter

	var data = value.setEncoding(['buffer']).data;

	var meta = JSON.stringify({
		mediaType: value.mediaType
	});

	var jsonSize = Buffer.byteLength(meta);

	var output = new Buffer(2 + jsonSize + 1 + data.length);
	output.writeUInt16BE(jsonSize, 0);
	output.write(meta + '\n', 2, jsonSize + 1, 'utf8');

	data.copy(output, 2 + jsonSize + 1);

	return output;
};


exports.deserialize = function (data, value) {
	var jsonSize = data.readUInt16BE(0);
	var meta = JSON.parse(data.toString('utf8', 2, 2 + jsonSize));

	data = data.slice(2 + jsonSize + 1);

	value.setData(meta.mediaType, data, 'buffer');
};


exports.createKey = function (topic, index) {
	// eg: weapons/actorId:123/bag:main
	// eg: weapons/guildId:123

	var key = topic, props, i;

	if (index) {
		props = Object.keys(index);
		props.sort();

		for (i = 0; i < props.length; i++) {
			key += '/' + props[i] + ':' + index[props[i]];
		}
	}

	return key;
};

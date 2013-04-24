var COL_VALUE = 'value';
var COL_MEDIATYPE = 'mediaType';


exports.serialize = function (value) {
	// { col: val, col: val, col: val }
	// throws exceptions on failure

	var cols = {};
	cols[COL_VALUE] = value.setEncoding(['utf8', 'buffer']).data;
	cols[COL_MEDIATYPE] = value.mediaType;

	return cols;
};


exports.deserialize = function (row, value) {
	var data = row[COL_VALUE];
	var mediaType = row[COL_MEDIATYPE];

	value.setData(mediaType, data);  // let encoding be detected by the VaultValue
};


exports.createKey = function (topic, index) {
	return {
		table: topic,
		pk: index
	};
};


exports.parseKey = function (key) {
	return {
		topic: key.table,
		index: key.pk
	};
};

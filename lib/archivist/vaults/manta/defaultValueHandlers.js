exports.serialize = function (value) {
	// throws exceptions on failure

	return {
		data: value.setEncoding(['buffer']).data,
		mediaType: value.mediaType
	};
};


exports.deserialize = function (obj, value) {
	value.setData(obj.mediaType || null, obj.data, 'buffer');
};


function encode(str) {
	// this escapes all potentially harmful characters: ['*', ':', '\\', '/', '<', '>', '|', '"', '?']
	return encodeURIComponent(str).replace(/\*/g, '%2A');
}


exports.createPath = function (topic, index) {
	// URL encoded with the arguments sorted alphabetically
	// eg: weapons#actorId=123&bag=main

	var path = encode(topic);

	if (index) {
		var props = Object.keys(index);
		var len = props.length;

		if (len > 0) {
			props.sort();

			path += '/';

			var sep = '';

			for (var i = 0; i < len; i += 1) {
				path = path.concat(sep, encode(props[i]), '=', encode(index[props[i]]));
				sep = '&';
			}
		}
	}

	return path;
};

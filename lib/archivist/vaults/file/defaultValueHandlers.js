var qs = require('querystring');
var pathBaseName = require('path').basename;
var mediaTypes = require('../../mediaTypes');


function safeExt(ext) {
	return ext[0] === '.' ? ext : '.' + ext;
}


exports.serialize = function (value) {
	// throws exceptions on failure

	value.setEncoding('buffer', { pretty: true });

	var mediaTypeApi = mediaTypes.getMediaType(value.mediaType);
	if (!mediaTypeApi) {
		throw new Error('Unsupported media type: ' + value.mediaType);
	}

	return {
		meta: {
			mediaType: value.mediaType,
			expirationTime: value.expirationTime || undefined,
			ext: safeExt(mediaTypeApi.fileExt) || '.bin'
		},
		content: value.data
	};
};


exports.deserialize = function (data, value) {
	var meta = data.meta;
	var content = data.content;

	// data is: { meta: {}, content: buffer }

	if (!Buffer.isBuffer(content)) {
		throw new Error('FileVault can only read binary');
	}

	// report the value object

	value.setData(meta.mediaType, content, 'buffer');
	value.setExpirationTime(meta.expirationTime);
};


exports.createKey = function (topic, index) {
	// URL encoded with the arguments sorted alphabetically
	// eg: weapons?actorId=123&bag=main

	var key = encodeURIComponent(topic);

	if (index) {
		var props = Object.keys(index);
		var len = props.length;

		if (len > 0) {
			props.sort();

			key = key.concat('?');

			var sep = '';

			for (var i = 0; i < len; i += 1) {
				key = key.concat(sep, encodeURIComponent(props[i]), '=', encodeURIComponent(index[props[i]]));
				sep = '&';
			}
		}
	}

	return key;
};


exports.parseKey = function (path) {
	var key = pathBaseName(path);

	var qsPos = key.indexOf('?');

	if (qsPos === -1) {
		return {
			topic: decodeURIComponent(key),
			index: {}
		};
	}

	return {
		topic: decodeURIComponent(key.substr(0, qsPos)),
		index: qs.parse(key.substr(qsPos + 1))
	};
};

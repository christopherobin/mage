var Tome = require('tomes').Tome;

// media types:
//   application/json
//   application/x-tome
//   application/x-tomediff
//   application/octet-stream
// encoding:
//   live (native JS objects, does not include Buffer instances)
//   utf8 (string)
//   buffer (Buffer object)
//   base64 (base64 encoded binary data)


// encoders

var regEncoders = {};

function addEncoder(fromTo, fn) {
	fromTo = fromTo.split('-');
	var fromEncoding = fromTo[0];
	var toEncoding = fromTo[1];

	if (!regEncoders[fromEncoding]) {
		regEncoders[fromEncoding] = {};
	}

	regEncoders[fromEncoding][toEncoding] = fn;
}

exports.addEncoder = addEncoder;

function getEncoder(fromEncoding, toEncoding) {
	if (regEncoders[fromEncoding]) {
		return regEncoders[fromEncoding][toEncoding];
	}
}


addEncoder('utf8-buffer', function (data) { return new Buffer(data); });
addEncoder('base64-buffer', function (data) { return new Buffer(data, 'base64'); });
addEncoder('buffer-base64', function (data) { return data.toString('base64'); });
addEncoder('buffer-utf8', function (data) { return data.toString('utf8'); });
addEncoder('utf8-base64', function (data) { return (new Buffer(data, 'utf8')).toString('base64'); });
addEncoder('base64-utf8', function (data) { return (new Buffer(data, 'base64')).toString('utf8'); });


// All encodings can convert to each other out of the box, except: live!
// "live" is the special case that each media type implements an encoder to.
// Each media type that can exist as a special live instance has to implement at
// least one "anything-live" and one "live-anything".
// It should only implement those that it can do incredibly efficiently in a single direction.
// Built-in encoding conversion should be relied upon to do the best job outside of the
// scope of the media type.
// Other media types, that have no live representation (but instead exist only in
// string/buffer form) don't need these (or any) encoders.

var regMediaTypes = {
	'application/x-tome': {
		encoders: {
			'utf8-live': function (data) { return Tome.conjure(JSON.parse(data)); },
			'live-utf8': function (tome, options) { return JSON.stringify(tome, null, options.pretty ? true : false); }
		},
		diff: {
			get: function (tome) {
				return tome.read();
			},
			set: function (tome, diff) {
				tome.merge(diff);
			}
		},
		init: function (tome, value) {
			function onchange() {
				value.markAsChanged();
			}

			tome.on('readable', onchange);

			return onchange;
		},
		uninit: function (tome, value, onchange) {
			tome.removeListener('readable', onchange);
		}
	},
	'application/json': {
		encoders: {
			'utf8-live': JSON.parse,
			'live-utf8': function (data, options) { return JSON.stringify(data, null, options.pretty ? true : false); }
		},
		convertors: {
			'application/x-tome': function (fromValue, toValue) {
				// only live data is different between tome/json
				// as long as the JSON is serialized, they are equal and need no new serialization

				if (fromValue.encoding === 'live') {
					toValue.setData(Tome.conjure(fromValue.data), 'live');
				} else {
					toValue.setData(fromValue.data, fromValue.encoding);
				}
			}
		}
	},
	'text/plain': {},
	'application/octet-stream': {}
};


function Value(mediaType, data, encoding, versions) {
	this.hasChanged = false;
	this.mediaType = mediaType;

	this.versions = versions || {};   // cache for all the versions by mediaType (incl the original)
	this.versions[mediaType] = this;  // self register
	this.encodings = {};              // cache for all differently encoded versions of this.mediaType

	// data/encoding match the latest selected encoding
	// all encoded versions however can be found in this.encodings[]

	this.data = undefined;
	this.encoding = undefined;

	this.liveVersionMeta = undefined;
	this.liveDiff = undefined;

	this.setData(data, encoding);
}

exports.Value = Value;


Value.prototype.getDiff = function () {
	if (this.liveDiff === undefined && this.encodings.live) {
		var api = regMediaTypes[this.mediaType];

		if (api && api.diff && api.diff.get) {
			this.liveDiff = api.diff.get(this.encodings.live);
		}
	}

	return this.liveDiff;
};


Value.prototype.applyDiff = function (diff) {
	var api = regMediaTypes[this.mediaType];

	if (api && api.diff && api.diff.get) {
		this.setEncoding(['live']);

		api.diff.set(this.encodings.live, diff);
	}
};


Value.prototype.setData = function (data, encoding, unchanged) {
	this.data = data;
	this.encoding = encoding;

	// if data is a new value that we were not aware of before, and the encoding is 'live',
	// we should run init on it, since we need to make the data aware of the value it is now
	// part of.

	if (encoding === 'live') {
		var api = regMediaTypes[this.mediaType];

		if (api) {
			var prevLive = this.encodings.live;

			if (prevLive && prevLive !== data && api.uninit) {
				api.uninit(prevLive, this, this.liveVersionMeta);
				this.liveVersionMeta = undefined;
			}

			if ((!prevLive || prevLive !== data) && api.init) {
				this.liveVersionMeta = api.init(data, this);
			}
		}
	}

	// if change is not suppressed, and we overwrite an existing value, we have to
	// mark the change

	if (!unchanged && this.encodings[encoding] && this.encodings[encoding] !== data) {
		this.markAsChanged();
	}

	// keep track of this encoded version

	this.encodings[encoding] = data;
};


Value.prototype.getEncoder = function (fromEncoding, toEncoding) {
	// edge case: from === to

	if (fromEncoding === toEncoding) {
		return function (data) { return data; };
	}

	// hot path: no live encoding involved

	if (fromEncoding !== 'live' && toEncoding !== 'live') {
		if (regEncoders[fromEncoding]) {
			return regEncoders[fromEncoding][toEncoding];
		}

		throw new Error('No encoder found between ' + fromEncoding + ' and ' + toEncoding);
	}

	var mtApi = regMediaTypes[this.mediaType];
	if (!mtApi) {
		throw new Error('Unknown media type: ' + this.mediaType);
	}

	var encoders = mtApi.encoders;
	if (!encoders) {
		throw new Error('No live encoders registered for media type ' + this.mediaType);
	}

	// if we have the perfect encoder: bull's eye

	var encoder = encoders[fromEncoding + '-' + toEncoding];
	if (encoder) {
		return encoder;
	}

	// if we don't, we have to make one step in between

	var key, keys = Object.keys(encoders);
	var encoderA, encoderB;

	for (var i = 0; i < keys.length; i++) {
		encoder = encoders[keys[i]];
		key = keys[i].split('-');
		encoderA = encoderB = null;

		if (key[0] === fromEncoding) {
			// key[0] -> key[1] -> toEncoding

			encoderA = encoder;
			encoderB = getEncoder(key[1], toEncoding);
			break;
		}

		if (key[1] === toEncoding) {
			// fromEncoding -> key[0] -> key[1]

			encoderA = getEncoder(fromEncoding, key[0]);
			encoderB = encoder;
			break;
		}
	}

	if (!encoderA || !encoderB) {
		throw new Error('Could not find a conversion strategy for ' + fromEncoding);
	}

	// return an encoder based on A and B

	return function (data, options) {
		return encoderB(encoderA(data, options), options);
	};
};


Value.prototype.setEncoding = function (toEncodings, options) {
	if (!Array.isArray(toEncodings)) {
		toEncodings = [toEncodings];
	}

	var i, len = toEncodings.length, a, alen, available, fromEncoding, toEncoding, encoder;

	// strategy:
	// we try to convert to a useful encoding, and return "this".

	// if we already have any of the requested encodings, we set that encoding to the active one.

	for (i = 0; i < len; i++) {
		toEncoding = toEncodings[i];

		// if we have converted to this encoding before, return that version

		if (this.encodings[toEncoding]) {
			this.data = this.encodings[toEncoding];
			this.encoding = toEncoding;
			return this;
		}
	}

	// if we don't, we try to convert in order of requested encodings

	available = Object.keys(this.encodings);
	alen = available.length;

	for (i = 0; i < len; i++) {
		toEncoding = toEncodings[i];

		for (a = 0; a < alen; a++) {
			fromEncoding = available[a];

			try {
				encoder = this.getEncoder(fromEncoding, toEncoding);

				var data = encoder(this.encodings[fromEncoding], options || {});

				this.setData(data, toEncoding, true);

				return this;
			} catch (error) {
				// ignore the error, keep on trying other encoders
				console.log('Warning:', error);
			}
		}
	}

	throw new Error('No encoder found from ' + available.join(', ') + ' to any of: ' + toEncodings.join(', '));
};


Value.prototype.toMediaType = function (mediaTypes) {
	if (!Array.isArray(mediaTypes)) {
		mediaTypes = [mediaTypes];
	}

	for (var i = 0; i < mediaTypes.length; i++) {
		var mediaType = mediaTypes[i];

		// if the requested mediaType was already converted to, return that version

		var version = this.versions[mediaType];
		if (version) {
			return version;
		}

		// find a convertor implemention from the original mediaType to the requested mediaType

		var convertor = regMediaTypes[this.mediaType].convertors[mediaType];

		if (convertor) {
			// convert to this mediaType and return it

			var toValue = new Value(mediaType, undefined, undefined, this.versions);

			convertor(this, toValue);

			return toValue;
		}
	}

	throw new Error('Unable to convert from mediaType ' + this.mediaType + ' to any of: ' + mediaTypes.join(', '));
};


Value.prototype.markAsChanged = function () {
	this.hasChanged = true;

	var mediaTypes = Object.keys(this.versions);
	var encodings = Object.keys(this.encodings);
	var i;

	// remove all converted versions, since they have been invalidated

	for (i = 0; i < mediaTypes.length; i++) {
		var mediaType = mediaTypes[i];

		if (mediaType !== this.mediaType) {
			delete this.versions[mediaTypes[i]];
		}
	}

	// remove all encodings, except "live" (since only "live" should generate markAsChanged)

	for (i = 0; i < encodings.length; i++) {
		var encoding = encodings[i];
		if (encoding !== 'live') {
			delete this.encodings[encoding];
		}
	}
};


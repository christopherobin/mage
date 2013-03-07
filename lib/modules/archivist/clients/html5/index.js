$file('../../../../../node_modules/tomes/tomes.js');

(function (window) {

	var Tome = window.Tome;

	// get the trueName function from rumplestiltskin

	var rumplestiltskin = {};

	(function (exports) {
		$file('../../../../../node_modules/rumplestiltskin/rumplestiltskin.js');
	}(rumplestiltskin));

	var createTrueName = rumplestiltskin.trueName;
	rumplestiltskin = null;


	// archivist module

	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.archivist.construct'));

	function Buffer(base64data) {
		this.data = base64data;
	}

	Buffer.prototype.toString = function () {
		return this.data;
	};


	function parseJson(data, encoding) {
		if (encoding === 'utf8') {
			return JSON.parse(data);
		}

		if (encoding === 'base64') {
			return JSON.parse(window.atob(data));
		}

		return data;
	}

	var regMediaTypes = {
		'*': {
			writer: function (value, mediaType, data) {
				value.mediaType = mediaType;
				value.data = data;
			}
		},
		'application/x-tome': {
			detector: function (data) {
				return Tome.isTome(data) ? 1 : 0;
			},
			encoders: {
				'utf8-live': function (data) {
					return Tome.conjure(parseJson(data, 'utf8'));
				},
				'live-utf8': function (tome) {
					return JSON.stringify(tome);
				}
			},
			diff: {
				get: function (tome) {
					return tome.read();
				},
				set: function (tome, diff) {
					tome.merge(diff);
				}
			}
		},
		'application/json': {
			detector: function () {
				return 0.5;
			},
			encoders: {
				'utf8-live': JSON.parse,
				'live-utf8': JSON.stringify
			}
		},
		'text/plain': {
			detector: function (data) {
				return (typeof data === 'string') ? 0.2 : 0;
			},
			encoders: {
				'utf8-live': function (data) { return data; },
				'live-utf8': function (data) { return data; }
			}
		},
		'application/octet-stream': {
			encoders: {
				'base64-live': function (data) {
					return new Buffer(data);
				},
				'live-base64': function (buffer) {
					return buffer.toString();
				}
			}
		}
	};

	var detectorList = [];
	for (var mediaType in regMediaTypes) {
		if (regMediaTypes[mediaType].detector) {
			detectorList.push(mediaType);
		}
	}


	function guessMediaType(data) {
		var lastCertainty = 0;
		var result;

		for (var i = 0, len = detectorList.length; i < len; i++) {
			var mediaType = detectorList[i];
			var detector = regMediaTypes[mediaType].detector;

			var certainty = detector(data);
			if (certainty >= 1) {
				// 100% certain, instantly return
				return mediaType;
			}

			if (certainty > lastCertainty) {
				lastCertainty = certainty;
				result = mediaType;
			}
		}

		return result;
	}


	function encode(data, mediaType, fromEncoding, toEncodings) {
		if (!Array.isArray(toEncodings)) {
			toEncodings = [toEncodings];
		}

		if (toEncodings.indexOf(fromEncoding) !== -1) {
			return { data: data, encoding: fromEncoding };
		}

		var spec = regMediaTypes[mediaType];
		var glob = regMediaTypes['*'];
		var encoders = spec.encoders || glob.encoders;

		for (var i = 0; i < toEncodings.length; i++) {
			var toEncoding = toEncodings[i];

			var encoder = encoders[fromEncoding + '-' + toEncoding];
			if (encoder) {
				return { data: encoder(data), encoding: toEncoding };
			}
		}
	}


	var loaded = {};

	function VaultValue() {
		this.mediaType = undefined;
		this.data = undefined;
		this.expirationTime = undefined;
	}


	VaultValue.prototype.touch = function (expirationTime) {
		this.expirationTime = expirationTime;

		// TODO: this should fire up a timer that calls this.del()
	};


	VaultValue.prototype.del = function () {
		if (Tome.isTome(this.data)) {
			Tome.destroy(this.data);
		}

		this.mediaType = undefined;
		this.data = undefined;
		this.encoding = undefined;
	};


	VaultValue.prototype.initWithData = function (mediaType, data, encoding) {
		var spec = regMediaTypes[mediaType];
		var glob = regMediaTypes['*'];
		var encoders = spec.encoders || glob.encoders;
		var writer = spec.writer || glob.writer;

		if (encoding !== 'live' && encoders) {
			var encoder = encoders[encoding + '-live'];
			if (!encoder) {
				// cannot encode
				return;
			}

			data = encoder(data);
		}

		if (writer) {
			writer(this, mediaType, data);
		}
	};


	VaultValue.prototype.applyDiff = function (diff) {
		var api = regMediaTypes[this.mediaType];

		if (api && api.diff && api.diff.set) {
			api.diff.set(this.data, diff);
		}
	};


	mage.io.on('archivist:write', function (path, info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (!value) {
			value = new VaultValue();

			loaded[trueName] = value;
		}

		var rawValue = info.value;

		value.initWithData(rawValue.mediaType, rawValue.data, rawValue.encoding);
		value.touch(info.expirationTime || undefined);
	});


	mage.io.on('archivist:writeDiff', function (path, info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (value) {
			if (info.diff) {
				value.applyDiff(info.diff);
			}

			if (info.expirationTime) {
				value.touch(info.expirationTime);
			}
		}
	});


	mage.io.on('archivist:touch', function (path, info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (value) {
			value.touch(info.expirationTime);
		}
	});


	mage.io.on('archivist:del', function (path, info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (value) {
			value.del();
		}
	});


	var ucRead = mod.read;
	var ucCreate = mod.create;


	mod.create = function (topic, index, data, mediaType, encoding, expirationTime, cb) {
		cb = cb || function () {};

		if (!encoding) {
			encoding = 'live';
		}

		if (!mediaType && encoding === 'live') {
			mediaType = guessMediaType(data);
		}

		if (encoding === 'live') {
			// turn live into a string, for transportation

			var result = encode(data, mediaType, 'live', ['utf8', 'base64']);
			if (!result) {
				return cb(new Error('Cannot encode ' + mediaType));
			}

			encoding = result.encoding;
			data = result.data;
		}

		ucCreate(topic, index, data, mediaType, encoding, expirationTime, cb);
	};


	mod.read = function (topic, index, options, cb) {
		if (typeof options === 'function') {
			cb = options;
			options = {};
		} else {
			options = options || {};
			cb = cb || function () {};
		}

		if (!options.hasOwnProperty('optional')) {
			options.optional = false;
		}

		var trueName = createTrueName(index || {}, topic);
		var value = loaded[trueName];

		if (value) {
			if (!value.data) {
				if (!options.optional) {
					return cb(new Error('Required value does not exist'));
				}
			}

			return cb(null, value.data);
		}

		return ucRead(topic, index, options, function (error) {
			if (error) {
				return cb(error);
			}

			// by now, the event for value creation must have fired...

			var value = loaded[trueName];
			if (!value) {
				// ...so this should really never happen
				return cb(null, undefined);
			}

			return cb(null, value.data);
		});
	};

}(window));

$file('../../../../../node_modules/tomes/tomes.js');

(function (window) {

	var Tome = window.Tome;

	// get the trueName function from rumplestiltskin

	var rumplestiltskin = {};

	(function (exports) {
		$file('../../../../../node_modules/rumplestiltskin/rumplestiltskin.js');
	}(rumplestiltskin));

	var trueName = rumplestiltskin.trueName;
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
		this.ttl = undefined;
		this.encoding = undefined;
	}


	VaultValue.prototype.touch = function (ttl) {
		this.ttl = ttl;
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
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (!value) {
			value = new VaultValue();

			loaded[key] = value;
		}

		var rawValue = info.value;

		value.initWithData(rawValue.mediaType, rawValue.data, rawValue.encoding);
		value.touch(info.ttl || undefined);
	});


	mage.io.on('archivist:writeDiff', function (path, info) {
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (value) {
			if (info.diff) {
				value.applyDiff(info.diff);
			}

			if (info.ttl) {
				value.touch(info.ttl);
			}
		}
	});


	mage.io.on('archivist:touch', function (path, info) {
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (value) {
			value.touch(info.ttl);
		}
	});


	mage.io.on('archivist:del', function (path, info) {
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (value) {
			delete loaded[key];

			if (Tome.isTome(value.data)) {
				Tome.destroy(value.data);
			}
		}
	});


	var ucRetrieveRaw = mod.retrieveRaw;


	mod.create = function (topic, index, data, mediaType, encoding, ttl, cb) {
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

		mod.createRaw(topic, index, data, mediaType, encoding, ttl, cb);
	};


	mod.retrieveRaw = function (topic, index, options, cb) {
		if (typeof options === 'function') {
			cb = options;
			options = {};
		} else {
			options = options || {};
		}

		if (!options.hasOwnProperty('optional')) {
			options.optional = false;
		}

		var key = trueName(index || {}, topic);
		var value = loaded[key];

		if (value) {
			if (!value.data) {
				if (!options.optional) {
					return cb(new Error('Required value does not exist'));
				}
			}

			return cb(null, value.data);
		}

		ucRetrieveRaw(topic, index, options, function (error) {
			if (error) {
				return cb(error);
			}

			// by now, the event for value creation must have fired...

			var value = loaded[key];
			if (!value) {
				// ...so this should really never happen
				return cb(null, undefined);
			}

			cb(null, value.data);
		});
	};


	mod.retrieve = function (topic, index, options, cb) {
		if (typeof options === 'function') {
			cb = options;
			options = {};
		}

		if (!options.hasOwnProperty('mediaType')) {
			options.mediaType = 'application/x-tome';
		}

		mod.retrieveRaw(topic, index, options, cb);
	};

}(window));

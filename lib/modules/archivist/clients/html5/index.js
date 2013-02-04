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
			encoders: {
				'utf8-live': function (data) {
					return Tome.conjure(parseJson(data, 'utf8'));
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
			encoders: {
				'utf8-live': JSON.parse
			}
		},
		'application/octet-stream': {
			encoders: {
				'base64-live': function (data) {
					return new Buffer(data);
				}
			}
		}
	};


	var loaded = {};

	function VaultValue() {
		this.mediaType = undefined;
		this.data = undefined;
		this.ttl = undefined;
	}


	VaultValue.prototype.setTTL = function (ttl) {
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
		value.setTTL(info.ttl || undefined);
	});


	mage.io.on('archivist:writeDiff', function (path, info) {
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (value) {
			if (info.diff) {
				value.applyDiff(info.diff);
			}

			if (info.ttl) {
				value.setTTL(info.ttl);
			}
		}
	});


	mage.io.on('archivist:touch', function (path, info) {
		var key = trueName(info.key.index || {}, info.key.topic);
		var value = loaded[key];

		if (value) {
			value.setTTL(info.ttl);
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

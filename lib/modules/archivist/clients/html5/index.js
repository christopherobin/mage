$file('../../../../../node_modules/tomes/tomes.js');

(function () {

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

	function Jacket(value, ttl) {
		this.value = value;
		this.ttl = ttl;
	}


	Jacket.prototype.setTTL = function (ttl) {
		this.ttl = ttl;
	};


	function Value() {
		this.mediaType = undefined;
		this.data = undefined;
	}


	Value.prototype.set = function (mediaType, data, encoding) {
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


	Value.prototype.applyDiff = function (diff) {
		var api = regMediaTypes[this.mediaType];

		if (api && api.diff && api.diff.set) {
			api.diff.set(this.data, diff);
		}
	};


	mage.io.on('archivist:create', function (path, info) {
		var key = trueName(info.key.vars, info.key.topic);

		var value = new Value();
		value.set(info.mediaType, info.data, info.encoding);

		loaded[key] = new Jacket(value, info.ttl);
	});


	mage.io.on('archivist:update', function (path, info) {
		var key = trueName(info.key.vars, info.key.topic);
		var jacket = loaded[key];

		if (jacket && jacket.value) {
			if (info.diff) {
				jacket.value.applyDiff(info.diff);
			} else {
				jacket.value.set(info.mediaType, info.data, info.encoding);
			}

			if (info.hasOwnProperty('ttl')) {
				jacket.setTTL(info.ttl);
			}
		}
	});


	mage.io.on('archivist:touch', function (path, info) {
		var key = trueName(info.key.vars, info.key.topic);
		var jacket = loaded[key];

		if (!jacket) {
			return;
		}

		jacket.ttl = info.ttl;
	});


	mage.io.on('archivist:del', function (path, info) {
		var key = trueName(info.key.vars, info.key.topic);
		var jacket = loaded[key];

		if (jacket) {
			delete loaded[key];

			var data = jacket.value ? jacket.value.data : undefined;
			if (Tome.isTome(data)) {
				Tome.destroy(data);
			}
		}
	});


	var ucRetrieveRaw = mod.retrieveRaw;
	var ucCreateRaw = mod.createRaw;


	mod.retrieveRaw = function (topic, vars, options, cb) {
		if (typeof options === 'function') {
			cb = options;
			options = {};
		} else {
			options = options || {};
		}

		if (!options.hasOwnProperty('optional')) {
			options.optional = false;
		}

		var key = trueName(vars, topic);
		var jacket = loaded[key];

		if (jacket) {
			if (!jacket.value && !options.optional) {
				return cb(new Error('Required value does not exist'));
			}

			return cb(null, jacket.value.data);
		}

		ucRetrieveRaw(topic, vars, options, function (error) {
			if (error) {
				return cb(error);
			}

			// by now, the event for value creation must have fired...

			var jacket = loaded[key];
			if (!jacket) {
				// ...so this should really never happen
				return cb(null, undefined);
			}

			cb(null, jacket.value.data);
		});
	};


	mod.retrieve = function (topic, vars, options, cb) {
		if (typeof options === 'function') {
			cb = options;
			options = {};
		}

		if (!options.hasOwnProperty('mediaType')) {
			options.mediaType = 'application/x-tome';
		}

		mod.retrieveRaw(topic, vars, options, cb);
	};


	mod.createRaw = function (topic, vars, mediaType, data, encoding, ttl, cb) {
		ucCreateRaw(topic, vars, mediaType, data, encoding, ttl, function (error) {
			if (error) {
				return cb && cb(error);
			}

			var key = trueName(vars, topic);

			var value = new Value();
			value.set(mediaType, data, encoding);

			loaded[key] = new Jacket(value, ttl);

			return cb && cb();
		});
	};

}());

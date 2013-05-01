$file('../../../../../node_modules/tomes/tomes.js');

(function (window) {

	var Tome = window.Tome;

	// get the trueName function from rumplestiltskin

	var rumplestiltskin = {};

	(function (exports) {
		exports = exports;
		$file('../../../../../node_modules/rumplestiltskin/rumplestiltskin.js');
	}(rumplestiltskin));

	var createTrueName = rumplestiltskin.trueName;
	rumplestiltskin = null;


	// archivist module

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.archivist.construct'));
	var loaded = {};


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
			writer: function (value, mediaType, tome) {
				function onchange() {
					var diff, diffs = [];

					while ((diff = tome.read())) {
						diffs.push(diff);
					}

					mod.applyDiff(value.topic, value.index, diffs);
				}

				if (value.data !== tome && mod.applyDiff) {
					// a new tome

					tome.on('readable', onchange);
				}
			},
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
					var diff, diffs = [];

					while ((diff = tome.read())) {
						diffs.push(diff);
					}

					return diffs;
				},
				set: function (tome, diffs) {
					tome.merge(diffs);
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
		var encoders = (spec && spec.encoders) || glob.encoders || {};

		for (var i = 0; i < toEncodings.length; i++) {
			var toEncoding = toEncodings[i];

			var encoder = encoders[fromEncoding + '-' + toEncoding];
			if (encoder) {
				data = encoder(data);

				return { data: data, encoding: toEncoding };
			}
		}

		throw new Error('No encoder found from ' + fromEncoding + ' to ' + toEncodings);
	}


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
			// this also resets all event listeners

			Tome.destroy(this.data);
		}

		this.mediaType = undefined;
		this.data = undefined;
		this.encoding = undefined;
	};


	VaultValue.prototype.setData = function (mediaType, data, encoding) {
		var spec = regMediaTypes[mediaType];
		var glob = regMediaTypes['*'];
		var encoders = (spec && spec.encoders) || glob.encoders || {};
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


	// catch events

	function evtSet(info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (!value) {
			value = new VaultValue();

			loaded[trueName] = value;
		}

		var rawValue = info.value;

		value.setData(rawValue.mediaType, rawValue.data, rawValue.encoding);
		value.touch(info.expirationTime || undefined);
	}


	function evtApplyDiff(info) {
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
	}


	function evtTouch(info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (value) {
			value.touch(info.expirationTime);
		}
	}


	function evtDel(info) {
		var trueName = createTrueName(info.key.index || {}, info.key.topic);
		var value = loaded[trueName];

		if (value) {
			value.del();
		}
	}

	// if we're making changes ourselves, we should ignore incoming events

	var distributing = false;

	mage.io.on('archivist:set', function (path, info) {
		if (!distributing) {
			evtSet(info);
		}
	});


	mage.io.on('archivist:applyDiff', function (path, info) {
		if (!distributing) {
			evtApplyDiff(info);
		}
	});


	mage.io.on('archivist:touch', function (path, info) {
		if (!distributing) {
			evtTouch(info);
		}
	});


	mage.io.on('archivist:del', function (path, info) {
		if (!distributing) {
			evtDel(info);
		}
	});


	mod.clearCache = function () {
		loaded = {};
	};


	// mutation support

	if (mod.rawDistribute) {
		// changes are always treated as if they have already happened
		// so: distribute often!

		var changes = {};


		mod.distribute = function (cb) {
			cb = cb || function () {};

			// distributing = true;

			var distribution = [];
			var trueNames = Object.keys(changes);

			if (trueNames.length === 0) {
				return cb(null, []);
			}

			for (var i = 0; i < trueNames.length; i++) {
				distribution.push(changes[trueNames[i]]);
			}

			changes = {};

			mod.rawDistribute(distribution, function () {
				distributing = false;

				cb.apply(null, arguments);
			});
		};


		mod.add = function (topic, index, data, mediaType, encoding, expirationTime) {
			index = index || {};

			var trueName = createTrueName(index, topic);

			encoding = encoding || 'live';

			if (encoding === 'live') {
				mediaType = mediaType || guessMediaType(data);

				// turn live into a string, for transportation

				var result = encode(data, mediaType, 'live', ['utf8', 'base64']);

				encoding = result.encoding;
				data = result.data;
			}

			if (!mediaType) {
				throw new Error('Could not detect mediaType.');
			}

			changes[trueName] = {
				operation: 'add',
				topic: topic,
				index: index,
				data: data,
				mediaType: mediaType,
				encoding: encoding,
				expirationTime: expirationTime
			};

/*
			evtSet({
				key: { index: index, topic: topic },
				value: {
					encoding: encoding,
					mediaType: mediaType,
					data: data
				},
				expirationTime: expirationTime
			});
*/
		};


		mod.set = function (topic, index, data, mediaType, encoding, expirationTime) {
			index = index || {};

			var trueName = createTrueName(index, topic);

			encoding = encoding || 'live';

			if (encoding === 'live') {
				mediaType = mediaType || guessMediaType(data);

				// turn live into a string, for transportation

				var result = encode(data, mediaType, 'live', ['utf8', 'base64']);

				encoding = result.encoding;
				data = result.data;
			}

			if (!mediaType) {
				throw new Error('Could not detect mediaType.');
			}

			changes[trueName] = {
				operation: 'set',
				topic: topic,
				index: index,
				data: data,
				mediaType: mediaType,
				encoding: encoding,
				expirationTime: expirationTime
			};
/*
			evtSet({
				key: { index: index, topic: topic },
				value: {
					encoding: encoding,
					mediaType: mediaType,
					data: data
				},
				expirationTime: expirationTime
			});
*/
		};


		mod.del = function (topic, index) {
			index = index || {};

			var trueName = createTrueName(index, topic);

			changes[trueName] = {
				operation: 'del',
				topic: topic,
				index: index
			};
/*
			evtDel({
				key: { index: index, topic: topic }
			});
*/
		};


		mod.touch = function (topic, index, expirationTime) {
			index = index || {};

			var trueName = createTrueName(index, topic);

			changes[trueName] = {
				operation: 'touch',
				topic: topic,
				index: index,
				expirationTime: expirationTime
			};
/*
			evtTouch({
				key: { index: index, topic: topic },
				expirationTime: expirationTime
			});
*/
		};


		mod.applyDiff = function (topic, index, data, mediaType) {
			// data is like a tome

			index = index || {};

			var trueName = createTrueName(index, topic);

			mediaType = mediaType || guessMediaType(data);

			if (!mediaType) {
				throw new Error('Could not detect mediaType.');
			}

			var api = regMediaTypes[mediaType];

			if (!api || !api.diff || !api.diff.get) {
				throw new Error('Cannot read diffs from mediaType: ' + mediaType);
			}

			var diff = api.diff.get(data);

			changes[trueName] = {
				operation: 'applyDiff',
				topic: topic,
				index: index,
				diff: diff
			};
/*
			evtTouch({
				key: { index: index, topic: topic },
				expirationTime: expirationTime
			});
*/
		};
	}


	var loading = {};

	function createGetCallback(callback, options) {
		return function (error, value) {
			if (!callback) {
				return;
			}

			if (error) {
				callback(error);
			} else {
				// apply options

				if (!options.optional && value.data === undefined) {
					return callback(new Error('Required value does not exist'));
				}

				// return the value

				return callback(null, value);
			}
		};
	}

	function runGetCallbacks(trueNames, error) {
		for (var i = 0; i < trueNames.length; i++) {
			var trueName = trueNames[i];

			var callbacks = loading[trueName];
			delete loading[trueName];

			if (!callbacks) {
				continue;
			}

			for (var j = 0; j < callbacks.length; j++) {
				var callback = callbacks[j];

				if (error) {
					callback(error);
				} else {
					callback(null, loaded[trueName]);
				}
			}
		}
	}


	if (mod.rawGet) {
		mod.getValue = function (topic, index, options, cb) {
			if (typeof options === 'function') {
				cb = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			cb = createGetCallback(cb, options);

			var trueName = createTrueName(index || {}, topic);
			var value = loaded[trueName];

			if (value) {
				return cb(null, value);
			}

			// make a callback stack for this get operation, so that multiple gets for the same
			// trueName won't cause race conditions on the loaded-cache

			if (loading[trueName]) {
				loading[trueName].push(cb);
			} else {
				loading[trueName] = [cb];

				mod.rawGet(topic, index, options, function (error) {
					runGetCallbacks([trueName], error);
				});
			}
		};


		mod.get = function (topic, index, options, cb) {
			if (typeof options === 'function') {
				cb = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			mod.getValue(topic, index, options, function (error, value) {
				if (error) {
					cb(error);
				} else {
					cb(null, value.data);
				}
			});
		};
	}


	function forEach(target, fn) {
		if (Array.isArray(target)) {
			for (var i = 0; i < target.length; i++) {
				fn(i, target[i]);
			}
		} else {
			for (var key in target) {
				if (target.hasOwnProperty(key)) {
					fn(key, target[key]);
				}
			}
		}
	}


	if (mod.rawMGet) {
		mod.mgetValues = function (queries, options, cb) {
			if (typeof options === 'function') {
				cb = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			// flatten the object-notation for queries into an array

			var trueNames = [];
			var realQueries = [];
			var realResult = Array.isArray(queries) ? new Array(queries.length) : {};
			var masterError;

			forEach(queries, function (queryId, query) {
				var trueName = createTrueName(query.index || {}, query.topic);

				var callback = createGetCallback(function (error, value) {
					if (error) {
						masterError = error;
					} else {
						realResult[queryId] = value;
					}
				}, options);

				if (loaded.hasOwnProperty(trueName)) {
					// the value has already been cached

					return callback(null, loaded[trueName]);
				}

				// make sure we run our query

				trueNames.push(trueName);

				if (loading.hasOwnProperty(trueName)) {
					// a normal get-operation is already loading this value

					loading[trueName].push(callback);
				} else {
					// first time someone asks for this value, so load it

					loading[trueName] = [callback];
					realQueries.push(query);
				}
			});

			// if nothing is loading or needs to be loaded, do nothing

			if (trueNames.length === 0) {
				return cb(null, realResult);
			}

			return mod.rawMGet(realQueries, options, function (error) {
				runGetCallbacks(trueNames, error); // the get-function should also use this for callbacks

				error = error || masterError;

				if (error) {
					cb(error);
				} else {
					cb(null, realResult);
				}
			});
		};


		mod.mget = function (queries, options, cb) {
			if (typeof options === 'function') {
				cb = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			mod.mgetValues(queries, options, function (error, values) {
				if (error) {
					cb(error);
				} else {
					var realResult = Array.isArray(values) ? new Array(values.length) : {};

					forEach(values, function (queryId, value) {
						realResult[queryId] = value.data;
					});

					cb(null, realResult);
				}
			});
		};
	}

}(window));

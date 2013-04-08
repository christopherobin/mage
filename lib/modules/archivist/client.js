var Tome = require('tomes').Tome;
var createTrueName = require('rumplestiltskin').trueName;
var msgServer = require('msgServer');
var time = require('time');

var loaded = {};
var timers = {};

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

var regMediaTypes = {
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
	var encoders = (spec && spec.encoders) || glob.encoders;

	if (!encoders) {
		return;
	}

	for (var i = 0; i < toEncodings.length; i++) {
		var toEncoding = toEncodings[i];

		var encoder = encoders[fromEncoding + '-' + toEncoding];
		if (encoder) {
			return { data: encoder(data), encoding: toEncoding };
		}
	}
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


function VaultValue() {
	this.mediaType = undefined;
	this.data = undefined;
	this.expirationTime = undefined;
}


function applyTTL(trueName, expirationTimeOnServer) {
	clearTimeout(timers[trueName]);

	var expirationTime = expirationTimeOnServer ? time.serverTimeToClientTime(expirationTimeOnServer) : undefined;

	if (loaded[trueName]) {
		loaded[trueName].expirationTime = expirationTime;
	}

	if (!expirationTime) {
		return;
	}

	var ttl = expirationTime * 1000 - new Date();

	timers[trueName] = setTimeout(function expire() {
		loaded[trueName].del();
		delete timers[trueName];
	}, ttl);
}


VaultValue.prototype.del = function () {
	if (Tome.isTome(this.data)) {
		Tome.destroy(this.data);
	}

	this.mediaType = undefined;
	this.data = undefined;
	this.encoding = undefined;
	this.expirationTime = undefined;
};


VaultValue.prototype.setData = function (mediaType, data, encoding) {
	var encoders = regMediaTypes[mediaType].encoders;

	if (encoding !== 'live' && encoders) {
		var encoder = encoders[encoding + '-live'];
		if (!encoder) {
			// cannot encode
			return;
		}

		data = encoder(data);
	}

	this.mediaType = mediaType;
	this.data = data;
};


VaultValue.prototype.applyDiff = function (diff) {
	var api = regMediaTypes[this.mediaType];

	if (api && api.diff && api.diff.set) {
		api.diff.set(this.data, diff);
	}
};


msgServer.on('archivist:set', function (path, info) {
	var trueName = createTrueName(info.key.index || {}, info.key.topic);
	var value = loaded[trueName];

	if (!value) {
		value = new VaultValue();

		loaded[trueName] = value;
	}

	var rawValue = info.value;

	value.setData(rawValue.mediaType, rawValue.data, rawValue.encoding);
	applyTTL(trueName, info.expirationTime);
});


msgServer.on('archivist:applyDiff', function (path, info) {
	var trueName = createTrueName(info.key.index || {}, info.key.topic);
	var value = loaded[trueName];

	if (value) {
		if (info.diff) {
			value.applyDiff(info.diff);
			applyTTL(trueName, info.expirationTime);
		}
	}
});


msgServer.on('archivist:touch', function (path, info) {
	var trueName = createTrueName(info.key.index || {}, info.key.topic);
	applyTTL(trueName, info.expirationTime);
});


msgServer.on('archivist:del', function (path, info) {
	var trueName = createTrueName(info.key.index || {}, info.key.topic);
	var value = loaded[trueName];

	if (value) {
		value.del();
	}
});


exports.getCache = function () {
	return loaded;
};


exports.clearCache = function () {
	loaded = {};
};


exports.add = function (topic, index, data, mediaType, encoding, expirationTime, cb) {
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

	exports.rawAdd(topic, index, data, mediaType, encoding, expirationTime, cb);
};


exports.set = function (topic, index, data, mediaType, encoding, expirationTime, cb) {
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

	exports.rawSet(topic, index, data, mediaType, encoding, expirationTime, cb);
};


exports.getValue = function (topic, index, options, cb) {
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

		exports.rawGet(topic, index, options, function (error) {
			runGetCallbacks([trueName], error);
		});
	}
};


exports.get = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else if (!options) {
		options = {};
	}

	exports.getValue(topic, index, options, function (error, value) {
		if (error) {
			cb(error);
		} else {
			cb(null, value.data);
		}
	});
};


exports.mgetValues = function (queries, options, cb) {
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

	return exports.rawMGet(realQueries, options, function (error) {
		runGetCallbacks(trueNames, error); // the get-function should also use this for callbacks

		error = error || masterError;

		if (error) {
			cb(error);
		} else {
			cb(null, realResult);
		}
	});
};


exports.mget = function (queries, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else if (!options) {
		options = {};
	}

	exports.mgetValues(queries, options, function (error, values) {
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


exports.applyDiff = exports.rawApplyDiff;
exports.del = exports.rawDel;
exports.list = exports.rawList;
exports.touch = exports.rawTouch;

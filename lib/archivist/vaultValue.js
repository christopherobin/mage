var mage = require('../mage');
var logger = mage.core.logger;
var encoders = require('./encoders');
var mediaTypes = require('./mediaTypes');


// data: data in a specific encoding
// value: a container for data, that is encoding and mediaType aware
//        and has API for controlling its lifecycle

// topic: a category of data
// index: a pointer to a specific piece of data for a given topic (alt: "index")


function VaultValue(topic, index, mediaType) {
	// mediaType is optional, and may be set on initWithData

	this.operation = null; // null (no change), 'create', 'touch', 'update', 'delete'
	this.readMisses = [];

	this.topic = topic;
	this.index = index;
	this.expirationTime = undefined;
	this.mediaType = mediaType || undefined;
	this.initialized = false;

	this.data = undefined;
	this.encoding = undefined;

	this.encodings = {};   // cache for all differently encoded versions of this.mediaType (holds only data)

	// data/encoding match the latest selected encoding
	// all encoded versions however can be found in this.encodings[]

	this.liveVersionMeta = undefined;
	this.liveDiff = undefined;
}

exports.VaultValue = VaultValue;


VaultValue.prototype.applyOperation = function (operation) {
	// null, "create" and "delete" always beat any pre-existing operation
	// we only "update", if we haven't created
	// we only "touch", if we haven't done anything else yet

	switch (operation) {
	case null:
	case 'create':
	case 'del':
		this.operation = operation;
		break;
	case 'update':
		if (this.operation !== 'create') {
			this.operation = operation;
		}
		break;
	case 'touch':
		if (!this.operation) {
			this.operation = operation;
		}
		break;
	default:
		throw new Error('Invalid vault data operation: ' + operation);
	}
};


VaultValue.prototype.getOperationForVault = function (vault) {
	// if this value should still exist, and if there was a read-miss on this vault,
	// we should recreate the full value on this vault

	if (this.operation !== 'del' && this.readMisses.indexOf(vault) !== -1) {
		return 'create';
	}

	// else we simply execute the scheduled operation

	return this.operation;
};


VaultValue.prototype.registerReadMiss = function (vault) {
	this.readMisses.push(vault);
};


VaultValue.prototype.touch = function (expirationTime) {
	this.expirationTime = expirationTime || undefined;

	this.applyOperation('touch');
};


VaultValue.prototype.del = function () {
	this.invalidateAllVersions();

	this.data = undefined;
	this.encoding = undefined;
	this.mediaType = undefined;

	this.applyOperation('del');
};


VaultValue.prototype.getDiff = function () {
	if (this.liveDiff === undefined && this.encodings.live) {
		var api = mediaTypes.getMediaType(this.mediaType);

		if (api && api.diff && api.diff.get) {
			this.liveDiff = api.diff.get(this.encodings.live);
		}
	}

	return this.liveDiff;
};


VaultValue.prototype.applyDiff = function (diff) {
	var api = mediaTypes[this.mediaType];

	if (api && api.diff && api.diff.get) {
		this.setEncoding(['live']);

		api.diff.set(this.encodings.live, diff);
	}
};


VaultValue.prototype.initWithData = function (mediaType, data, encoding) {
	// if no encoding is given, we try to detect it

	if (!encoding) {
		encoding = encoders.guessEncoding(data);
	}

	if (!mediaType && encoding === 'live') {
		mediaType = mediaTypes.guessMediaType(data);
	}

	// if data is a new value that we were not aware of before, and the encoding is 'live',
	// we should run init on it, since we need to make the data aware of the value it is now
	// part of.

	if (encoding === 'live') {
		// if there was a live data already, which is not the data we are writing now,
		// we should uninitialize it

		var prevLive = this.encodings.live;
		var api = mediaTypes.getMediaType(this.mediaType);

		if (prevLive && prevLive !== data && api && api.uninit) {
			api.uninit(prevLive, this, this.liveVersionMeta);
			this.liveVersionMeta = undefined;
		}

		// initialize the new data

		api = mediaTypes.getMediaType(mediaType);
		if ((!prevLive || prevLive !== data) && api && api.init) {
			this.liveVersionMeta = api.init(data, this);
		}
	}

	// make changes permanent

	this.mediaType = mediaType;
	this.data = data;
	this.encoding = encoding;
	this.initialized = true;
	this.encodings[encoding] = data;
};


VaultValue.prototype.setData = function (mediaType, data, encoding) {
	// update our data
	// encoding and mediaType are optional
	// if a mediaType is not given, and one was already known, the known one is used.

	this.initWithData(mediaType || this.mediaType, data, encoding);

	// mark the write as a change

	this.markAsChanged();
};


VaultValue.prototype.getEncoder = function (fromEncoding, toEncoding) {
	var encoder = encoders.getEncoder(this.mediaType, fromEncoding, toEncoding);
	if (!encoder) {
		throw new Error('Could not find an encoding conversion strategy for ' + fromEncoding + ' to ' + toEncoding + ' on mediaType ' + this.mediaType);
	}

	return encoder;
};


VaultValue.prototype.setEncoding = function (toEncodings, options) {
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

				this.initWithData(this.mediaType, data, toEncoding);

				return this;
			} catch (error) {
				// ignore the error, keep on trying other encoders
				logger.warning(error);
			}
		}
	}

	throw new Error('No encoder found from ' + available.join(', ') + ' to any of: ' + toEncodings.join(', '));
};


VaultValue.prototype.setMediaType = function (toMediaTypes) {
	if (!Array.isArray(toMediaTypes)) {
		toMediaTypes = [toMediaTypes];
	}

	if (toMediaTypes.indexOf(this.mediaType) !== -1) {
		// nothing to do here, we're already an accepted mediaType
		return;
	}

	var currentMediaTypeApi = mediaTypes.getMediaType(this.mediaType);
	if (!currentMediaTypeApi || !currentMediaTypeApi.converters) {
		throw new Error('Cannot convert from ' + this.mediaType + ' values to any other mediaType.');
	}

	for (var i = 0; i < toMediaTypes.length; i++) {
		var mediaType = toMediaTypes[i];

		// find a converter implementation from the original mediaType to the requested mediaType

		var converter = currentMediaTypeApi.converters[mediaType];
		if (converter) {
			// convert using the found converter and overwrite our current data

			converter(this, this);
			return;
		}
	}

	throw new Error('Unable to convert from mediaType ' + this.mediaType + ' to any of: ' + toMediaTypes.join(', '));
};


VaultValue.prototype.invalidateAllVersions = function (exceptions) {
	var encodings = Object.keys(this.encodings);

	// remove all encodings, except "live" (since only "live" should generate markAsChanged)

	for (var i = 0; i < encodings.length; i++) {
		var encoding = encodings[i];

		if (!exceptions || exceptions.indexOf(encoding) === -1) {
			delete this.encodings[encoding];
		}
	}
};


VaultValue.prototype.markAsChanged = function () {
	this.invalidateAllVersions(['live']);
	this.applyOperation('update');
};

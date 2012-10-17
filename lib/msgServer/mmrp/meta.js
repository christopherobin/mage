var mithril = require('../../mithril'),
	util	= require('util');


// supported data types
// in the future, we may add support for protobuf, et al.

var DATATYPE = exports.DATATYPE = {
	UNKNOWN: 0,
	UTF8STRING: 1,
	JSON: 2
};


var FLAGS = exports.FLAGS = {
	NONE: 0,
	REPLY_EXPECTED: 1,
	AUTO_DESERIALIZE: 2,
	IS_RESPONSE_PKT: 8,
	DST_ATTAINED: 16,
	PAYLOAD_MODIFIED: 32,
	PAYLOAD_CORRUPTED: 64,
	PAYLOAD_ENCRYPTED: 128
};


function Meta(ttl, dataType, flags) {
	if (Buffer.isBuffer(ttl)) {
		this.data = ttl;
	} else {
		ttl = ttl || 16;
		dataType = dataType || DATATYPE.UNKNOWN;
		flags = flags || FLAGS.NONE;

		this.data = new Buffer([0, ttl, dataType, flags]);
	}
}


exports.Meta = Meta;


Meta.prototype = {
	get dataPosition() {
		return this.data[0];
	},
	set dataPosition(value) {
		this.data[0] = value;
	},
	get ttl() {
		return this.data[1];
	},
	set ttl(value) {
		this.data[1] = value;
	},
	get dataType() {
		return this.data[2];
	},
	set dataType(value) {
		this.data[2] = value;
	},
	get flags() {
		return this.data[3];
	},
	set flags(value) {
		this.data[3] = value;
	}
};


Meta.prototype.getBuffer = function () {
	return this.data;
};


Meta.prototype.deserialize = function (data) {
	try {
		switch (this.dataType) {
		case DATATYPE.UTF8STRING:
			return data.toString();
		case DATATYPE.JSON:
			return JSON.parse(data);
		case DATATYPE.UNKNOWN:
			return data;
		}

		mithril.core.logger.error('Received packet which could not be automatically deserialized.');
	} catch (e) {
		mithril.core.logger.error('Received packet with malformed data.');
	}

	return null;
};


Meta.prototype.serialize = function (data) {
	switch (this.dataType) {
	case DATATYPE.UTF8STRING:
		return data.toString();
	case DATATYPE.JSON:
		return JSON.stringify(data);
	case DATATYPE.UNKNOWN:
		return data;
	}

	mithril.core.logger.error('Received packet which could not be automatically serialized.');
};

Meta.prototype.toString = function () {
	return this.dataPosition;
};


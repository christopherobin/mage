var msgpack = require('msgpack-0.4'),
    mithril = require('../../mithril'),
	util	= require('util');


var DATATYPE = exports.DATATYPE = {
	UNKNOWN: 0,
	UTF8STRING: 1,
	JSON: 2,
	MSGPACK: 3,
	PROTOBUF: 4
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
	set dataPosition(val) {
		this.data[0] = val;
	},
	get ttl() {
		return this.data[1];
	},
	set ttl(val) {
		this.data[1] = val;
	},
	get dataType() {
		return this.data[2];
	},
	set dataType(val) {
		this.data[2] = val;
	},
	get flags() {
		return this.data[3];
	},
	set flags(val) {
		this.data[3] = val;
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
		case DATATYPE.MSGPACK:
			return msgpack.unpack(data);
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
	case DATATYPE.MSGPACK:
		return msgpack.pack(data);
	case DATATYPE.UNKNOWN:
		return data;
	}

	mithril.core.logger.error('Received packet which could not be automatically serialized.');
};

Meta.prototype.toString = function () {
	return this.dataPosition;
};

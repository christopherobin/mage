function Delivery(messagePacks) {
	this.messagePacks = messagePacks;
}

/* message format:
 *   4 bytes (uint32be): message pack ID
 *   4 bytes (uint32be): message pack byte-length
 *   N bytes: message back buffer
 *   ...repeat
 */

Delivery.fromBuffer = function (buff) {
	var messagePacks = {};
	var offset = 0;
	var id, packLen, pack;

	while (offset < buff.length) {
		id = buff.readUInt32BE(offset);
		packLen = buff.readUInt32BE(offset + 4);
		pack = buff.slice(offset + 8, offset + 8 + packLen);

		messagePacks[id] = pack;

		offset += 8 + packLen;
	}

	return new Delivery(messagePacks);
};


Delivery.prototype.toBuffer = function () {
	var ids = Object.keys(this.messagePacks);
	var id, pack;
	var i, len = ids.length;

	// first pass, calculate final buffer length

	var totalSize = 0;

	for (i = 0; i < len; i += 1) {
		pack = this.messagePacks[ids[i]];

		// 4 bytes (ID) + 4 bytes (message pack length) + N bytes (message pack buffer)

		totalSize += 4 + 4 + pack.length;
	}

	// second pass, generate the final buffer

	var buff = new Buffer(totalSize);
	var offset = 0;

	for (i = 0; i < len; i += 1) {
		id = ids[i];
		pack = this.messagePacks[id];

		buff.writeUInt32BE(id, offset);
		buff.writeUInt32BE(pack.length, offset + 4);
		pack.copy(buff, offset + 8);

		offset += 4 + 4 + pack.length;
	}

	return buff;
};

exports.pack = function (msgs) {
	if (!msgs) {
		return new Buffer(0);
	}

	// fixed identifier
	// Get the total size

	var msgId, size = 0;

	for (msgId in msgs) {
		// msgId (3 bytes) + chunk length (3 bytes) + chunk

		size += 3 + 3 + msgs[msgId].length;
	}

	var buffer = new Buffer(size);
	var counter = 0;

	for (msgId in msgs) {
		var msg     = msgs[msgId];
		var msgSize = msg.length;

		msgId = (msgId >>> 0);

		// pack msgId

		buffer[counter]     =  msgId & 255;
		buffer[counter + 1] = (msgId & 65280) >> 8;
		buffer[counter + 2] = (msgId & 16711680) >> 16;

		counter += 3;

		// pack msg size

		buffer[counter]     = msgSize & 255;
		buffer[counter + 1] = (msgSize & 65280) >> 8;
		buffer[counter + 2] = (msgSize & 16711680) >> 16;

		counter += 3;

		// pack msg

		msg.copy(buffer, counter);

		counter += msgSize;
	}

	return buffer;
};


exports.unpack = function (buffer) {
	var bufferLen = buffer.length;

	if (bufferLen === 0) {
		return null;
	}

	var msgs = {};
	var pos = 0;
	var msgId, msgSize, msg;

	while (pos < bufferLen) {
		// msgId

		msgId = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += 3;

		// msgSize

		msgSize = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += 3;

		// msg

		try {
			msg = buffer.slice(pos, pos + msgSize);
			msgs[msgId] = msg.toString();
		} catch (e) {
			return null;
		}

		pos += msgSize;
	}

	return msgs;
};

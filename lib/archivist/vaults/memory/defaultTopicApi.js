var createTrueName = require('rumplestiltskin').trueName;


function MemoryData(data, mediaType, encoding, expirationTime, topic, index) {
	this.data = data;
	this.mediaType = mediaType;
	this.encoding = encoding;
	this.expirationTime = expirationTime;
	this.topic = topic;
	this.index = index;
}


exports.serialize = function (value) {
	// throws exceptions on failure

	value.setEncoding(['utf8', 'base64']);

	return new MemoryData(value.data, value.mediaType, value.encoding, value.expirationTime, value.topic, value.index);
};


exports.deserialize = function (memoryData, value) {
	// throws exceptions on failure

	value.setData(memoryData.mediaType, memoryData.data, memoryData.encoding);
	value.setExpirationTime(memoryData.expirationTime);
};


exports.createKey = function (topic, index) {
	return createTrueName(index, topic);
};

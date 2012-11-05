var EventEmitter = require('events').EventEmitter;
var exports = module.exports = new EventEmitter();

var workerTimer = null;
var workerData = {};
var interval = null;

function presentData(inData) {
	var outData = {};

	for (var key in inData) {
		var inItem = inData[key];
		var outItem = outData[key] = {};

		if (inItem.hasOwnProperty('count')) {
			outItem.min = inItem.min;
			outItem.max = inItem.max;
			outItem.avg = inItem.total / inItem.count;
		} else {
			outData[key] = inItem;
		}
	}

	outData['process.pid'] = process.pid;

	return outData;
}

exports.sample = function (id, sample) {
	if (!sample) {
		sample = 0;
	}

	if (!workerData.hasOwnProperty(id)) {
		workerData[id] = {
			min: sample,
			max: sample,
			total: sample,
			count: 1
		};
	} else {
		workerData[id].min = Math.min(workerData[id].min, sample);
		workerData[id].max = Math.max(workerData[id].max, sample);
		workerData[id].total += sample;
		workerData[id].count += 1;
	}
};

exports.inc = function (id, n) {
	workerData[id] = (workerData[id] || 0) + (typeof n === 'number' ? n : 1);
};

exports.set = function (id, n) {
	workerData[id] = n;
};

exports.setup = function (duration) {
	interval = duration || 10000;
};

exports.start = function () {
	workerTimer = setInterval(function () {
		exports.emit('collect');
		exports.emit('sampleSet', presentData(workerData));
		workerData = {};
	}, interval);
};

exports.stop = function () { // Stops comms, use on shutdown.
	clearInterval(workerTimer);
};
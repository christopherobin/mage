var EventEmitter = require('events').EventEmitter;
var exports = module.exports = new EventEmitter();

var workerTimer = null;
var workerData = {};
var interval = null;


// A standard deviation object constructor. Running deviation (avoid growing arrays) which is round-off error resistant.
function StandardDeviation(firstMeasurement) {
	this.workData = firstMeasurement;
	this.lastWorkData = null;
	this.S = 0;
	this.count = 1;
}


// Add a measurement. Also calculates updates to stepwise parameters which are later used to determine sigma.
StandardDeviation.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.lastWorkData = this.workData;
	this.workData = this.workData + (measurement - this.workData) / this.count;
	this.S = this.S + (measurement - this.lastWorkData) * (measurement - this.workData);
};


// Performs the final step needed to get the standard deviation and returns it.
StandardDeviation.prototype.get = function () {
	return Math.sqrt(this.S / (this.count - 1));
};


// Not really necessary, but I'm doing this already for standard deviation anyway, so this is consistent.
function Average(firstMeasurement) {
	this.total = firstMeasurement;
	this.count = 1;
}


// Add a measurement. Increments the counter and updates the total.
Average.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.total += measurement;
};


// Get simply divides the total by the number of measurements taken and returns the result.
Average.prototype.get = function () {
	return this.total / this.count;
};


// The workerData object has methods and other information that is not needed beyond this library. This function refines
// the raw object into a data only object,
function presentData(inData) {
	var outData = {};

	for (var key in inData) {
		var inItem = inData[key];
		var outItem = outData[key] = {};

		if (inItem.sample) {
			outItem.min   = inItem.min;
			outItem.max   = inItem.max;
			outItem.avg   = inItem.average.get();
			outItem.sigma = inItem.standardDeviation.get();
		} else {
			outData[key] = inItem;
		}
	}

	outData['process.pid'] = process.pid;

	return outData;
}


// Take a sample for which the min, max, average and standard deviation are relevant and calculate these before
// insertion into the workerData object.
exports.sample = function (id, sample) {
	if (!Number.isFinite(sample)) {
		return;
	}

	// Add data to the sample if it already exists.
	if (workerData.hasOwnProperty(id)) {
		workerData[id].min = Math.min(workerData[id].min, sample);
		workerData[id].max = Math.max(workerData[id].max, sample);
		workerData[id].standardDeviation.addMeasurement(sample);
		workerData[id].average.addMeasurement(sample);
		return;
	}

	// Initialise a sample set.
	workerData[id] = {
		sample: true, // To let presentData know that samples need special treatment.
		min: sample,
		max: sample,
		standardDeviation: new StandardDeviation(sample),
		average: new Average(sample)
	};
};


// Take a counter and increment by n if given or 1. Set up the counter if it does not already exist as a field in the
// workerData object.
exports.inc = function (id, n) {
	workerData[id] = (workerData[id] || 0) + (Number.isFinite(n) ? n : 1);
};


// Create or overwrite a field in the workerData object.
exports.set = function (id, n) {
	workerData[id] = n;
};


// Clears the timeout if it is set.
exports.stop = function () { // Stops comms, use on shutdown.
	clearTimeout(workerTimer);
};


// Start a collection timer. When the timer finishes emit the sample set and reset workerData to an empty object.
exports.beginInterval = function (interval) {
	workerTimer = setTimeout(function () {
		exports.emit('sampleSet', presentData(workerData));
		workerData = {};
	}, interval || 10000);
};

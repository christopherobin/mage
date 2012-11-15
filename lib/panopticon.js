var EventEmitter = require('events').EventEmitter;
var exports = module.exports = new EventEmitter();

var workerTimer = null;


// Convenience object constructor.
function WorkerData() {
	this.init();
}


// Initialise or reinitialise workerData with server specific information.
WorkerData.prototype.init = function () {
	this.data = { pid: process.pid };
};


// We only care about the data.
WorkerData.prototype.toJSON = function () {
	return this.data;
};


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
StandardDeviation.prototype.toJSON = function () {
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
Average.prototype.toJSON = function () {
	return this.total / this.count;
};


// Sample taker object constructor.
function SampleTaker(sample) {
	this.min = sample;
	this.max = sample;
	this.standardDeviation = new StandardDeviation(sample);
	this.average = new Average(sample);
}


SampleTaker.prototype.addSample = function (sample) {
	this.min = Math.min(this.min, sample);
	this.max = Math.max(this.max, sample);
	this.standardDeviation.addMeasurement(sample);
	this.average.addMeasurement(sample);
};


var workerData = new WorkerData();


// Take a sample for which the min, max, average and standard deviation are relevant and calculate these before
// insertion into the workerData object.
exports.sample = function (id, sample) {
	if (!Number.isFinite(sample)) {
		return;
	}

	// Add data to the sample if it already exists. Otherwise initialise the sample
	if (workerData.data.hasOwnProperty(id)) {
		workerData.data[id].addSample(sample);
	} else {
		workerData.data[id] = new SampleTaker(sample);
	}
};


// Take a counter and increment by n if given or 1. Set up the counter if it does not already exist as a field in the
// workerData object.
exports.inc = function (id, n) {
	workerData.data[id] = (workerData[id] || 0) + (Number.isFinite(n) ? n : 1);
};


// Create or overwrite a field in the workerData object.
exports.set = function (id, n) {
	workerData.data[id] = n;
};


// Clears the timeout if it is set.
exports.stop = function () { // Stops comms, use on shutdown.
	clearTimeout(workerTimer);
};


// Start a collection timer. When the timer finishes emit the sample set and reset workerData to an empty object.
exports.beginInterval = function (interval) {
	workerTimer = setTimeout(function () {
		exports.emit('sampleSet', workerData);
		workerData.init();
	}, interval || 10000);
};

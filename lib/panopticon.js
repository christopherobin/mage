var EventEmitter = require('events').EventEmitter;
var cluster = require('cluster');

exports = module.exports = new EventEmitter();

var aggregationInterval = null;
var halfInterval = null;
var workerData = null;


// Convenience object constructor.
function WorkerData(startTime, interval) {
	// Set the interval from given data.
	this.interval = interval;
	this.endTime = startTime + interval;
	this.data = { pid: process.pid };

	this.timer = setTimeout(this.timeUp, interval);
}

WorkerData.prototype.timeUp = function () {
	if (this.endTime * 1000 > Date.now()) {

		// Emit the sample!
		exports.emit('sample', this);

		var now = Date.now();

		// If we got left behind for some reason, catch up here.
		do {
			this.endTime += this.interval;
		} while (this.endTime < now);

		// Reset the data.
		this.data = { pid: process.pid };

		// Reset the timeout.
		this.timer = setTimeout(this.timeUp, this.interval);
	}
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


// Take a sample for which the min, max, average and standard deviation are relevant and calculate these before
// insertion into the workerData object.
exports.sample = function (id, sample) {
	workerData.timeUp();

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
	workerData.timeUp();

	workerData.data[id] = (workerData.data[id] || 0) + (Number.isFinite(n) ? n : 1);
};


// Create or overwrite a field in the workerData object.
exports.set = function (id, n) {
	workerData.timeUp();

	workerData.data[id] = n;
};


exports.setup = function (cfg) {
	// Collect data for this process.
	workerData = new WorkerData(cfg.startTime, cfg.interval);

	// If the cluster is a worker, then we only need to send the master results.
	if (cluster.isWorker) {
		exports.on('sample', function (data) {
			process.send({ event: 'workerSample', pid: process.pid, sample: data });
		});

		return; // Nothing else to do here.
	}

	// The following pertains to the master (without clustering this still applies).
	var beginReportingIn = cfg.startTime + cfg.interval  - Date.now();

	// Initialise the aggregate.
	var aggregated = {
		numWorkers: Object.keys(cluster.workers).length,
		workers: {}
	};

	// Collect samples emitted by master.
	exports.on('sample', function (data) {
		aggregated.master = data;
	});

	// Listen to all workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		cluster.workers[workerId].on('message', function (message) {
			if (message.event === 'workerSample') {
				aggregated.workers[workerId] = message.sample;
			}
		});
	});

	// Wait half an interval before beginning the delivery interval.
	halfInterval = setTimeout(function () {

		// The setTimeout is here for two reasons. Firstly, we don't want this to fire until interval 1.5, at which it
		// starts an interval. Then, data is delivered at every n.5th interval.

		aggregationInterval = setInterval(function () {
			exports.emit('delivery', aggregated);
			aggregated = {
				numWorkers: Object.keys(cluster.workers).length,
				workers: {}
			};
		}, cfg.interval);

	}, beginReportingIn);
};


// Clears the interval and the timeout.
exports.stop = function () {
	clearTimeout(halfInterval);
	clearInterval(aggregationInterval);
};

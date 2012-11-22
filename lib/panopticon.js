var EventEmitter = require('events').EventEmitter;
var cluster = require('cluster');

module.exports = new EventEmitter();

var aggregationInterval = null;
var halfInterval = null;
var workerData = null;


// Convenience object constructor.
function WorkerData(startTime, interval) {
	// Set the interval from given data.
	var now = Date.now();

	this.interval = interval;
	this.endTime = startTime + interval;

	do {
		this.endTime += interval;
	} while (now > this.endTime);

	//console.log('endTime: ' + this.endTime + ', interval: ' + this.interval + ', machine: ' + (cluster.isMaster ? 'Master' : cluster.worker.id))

	this.data = { pid: process.pid };

	var that = this;
	this.timer = setTimeout(function () {
		//console.log('TIMEOUT FTW')
		that.timeUp();
	}, this.interval);
}

WorkerData.prototype.timeUp = function () {
	var now = Date.now();

	if (now > this.endTime) {

		// Emit the sample!
		//console.log('emitting from ' + (cluster.isMaster ? 'Master' : cluster.worker.id))
		module.exports.emit('sample', this.data);

		// If we got left behind for some reason, catch up here.
		do {
			this.endTime += this.interval;
		} while (now > this.endTime);

		// Reset the data.
		this.data = { pid: process.pid };

		// Reset the timeout.
		clearTimeout(this.timer);

		var that = this;
		this.timer = setTimeout(function () {
			//console.log('TIMEOUT ON ' + (cluster.isMaster ? 'Master' : cluster.worker.id))
			that.timeUp();
		}, this.interval);
	}
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
module.exports.sample = function (id, sample) {
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
module.exports.inc = function (id, n) {
	workerData.timeUp();

	workerData.data[id] = (workerData.data[id] || 0) + (Number.isFinite(n) ? n : 1);
};


// Create or overwrite a field in the workerData object.
module.exports.set = function (id, n) {
	workerData.timeUp();

	workerData.data[id] = n;
};


/**
 * Create dataloggers and being logging.
 *
 * @param {object} cfg Contains 'startTime 'and 'interval'. This object should be the same for all processes.
 */
module.exports.setup = function (cfg) {
	// Collect data for this process.
	workerData = new WorkerData(cfg.startTime, cfg.interval);

	// If the cluster is a worker, then we only need to send the master results.
	if (cluster.isWorker) {
		module.exports.on('sample', function (data) {
			//console.log('sending from worker ' + cluster.worker.id)
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
	module.exports.on('sample', function (data) {
		//console.log('sending from master')
		aggregated.workers.master = data;
	});

	// Listen to all workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		cluster.workers[workerId].on('message', function (message) {
			if (message.event === 'workerSample') {
				//console.log('master received sample from slave ' + workerId)
				aggregated.workers[workerId] = message.sample;
			}
		});
	});

	// Wait half an interval before beginning the delivery interval.
	halfInterval = setTimeout(function () {

		// The setTimeout is here for two reasons. Firstly, we don't want this to fire until interval 1.5, at which it
		// starts an interval. Then, data is delivered at every n.5th interval.

		aggregationInterval = setInterval(function () {
			module.exports.emit('delivery', aggregated);
			aggregated = {
				numWorkers: Object.keys(cluster.workers).length,
				workers: {}
			};
		}, cfg.interval);

	}, beginReportingIn);
};


// Clears the interval and the timeout.
module.exports.stop = function () {
	clearTimeout(halfInterval);
	clearInterval(aggregationInterval);
};

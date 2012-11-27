var EventEmitter = require('events').EventEmitter;
var cluster      = require('cluster');
var util         = require('util');


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


function Panopticon(startTime, interval) {
	EventEmitter.call(this);

	// First we sort out the methods and data which handle data local to this process.

	// Create a data container
	this.resetData();

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	this.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;

	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start =  Number.isFinite(startTime) ? startTime : 0;
	var offset = (start || 0 - now) % this.interval;

	// As startTime can be before now, we need to add an interval the so that the first end time is
	// in the future.
	this.endTime = (offset < 0) ? now + offset + this.interval : now + offset;

	// start the timer
	this.timer = null;
	this.timeUp();


	// Below we separate a panopticon instance running on master from those running on workers.

	// If the cluster is a worker, we only need to send the master results.
	if (cluster.isWorker) {
		this.on('sample', function (data) {
			process.send({ event: 'workerSample', pid: process.pid, sample: data });
		});

		// Nothing else to do for a worker.
		return;
	}

	// The following pertains to the master (without clustering this still applies). The master
	// needs to collect samples from itself and the workers.

	// Initialise the aggregated data object.
	this.initAggregate();

	// Need this to pass the scope into various anonymous functions below.
	var that = this;

	// Collect samples emitted by master.
	this.on('sample', function (data) {
		that.aggregated.workers.master = data;
	});

	// Collect samples emitted by workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		cluster.workers[workerId].on('message', function (message) {
			if (message.event === 'workerSample') {
				that.aggregated.workers[workerId] = message.sample;
			}
		});
	});

	// Wait half an interval before beginning the delivery interval.
	var beginReporting = this.endTime + this.interval / 2;

	this.halfInterval = setTimeout(function () {

		// Begin reporting 0.5 intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		that.aggregationInterval = setInterval(function () {
			that.emit('delivery', that.aggregated);

			that.initAggregate();
		}, that.interval);

	}, beginReporting);
}

util.inherits(Panopticon, EventEmitter);


Panopticon.prototype.initAggregate = function () {
	// For the master only. This object will contain the aggregated data from the master and the
	// workers.

	if (cluster.isMaster) {
		this.aggregated = {
			numWorkers: Object.keys(cluster.workers).length,
			workers: {}
		};
	}
};


Panopticon.prototype.resetData = function () {
	// the data property holds all the samples for a process.

	this.data = { pid: process.pid };
};


Panopticon.prototype.timeUp = function () {
	var now = Date.now();

	if (now >= this.endTime) {

		// If we got left behind for some reason, catch up here.
		do {
			this.endTime += this.interval;
		} while (this.endTime <= now);

		// Emit the sample!
		this.emit('sample', this.data);

		// Reset the data.
		this.resetData();

		// Reset the timeout.
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	// Recreate the timer if it's not running. The node.js timers have a bug which allows a timeout
	// to fire early sometimes. If that happens then the above evaluates to false, but the below
	// resets the timer, thus handling the issue. If the timer legitimately fires, then the below
	// acts to reset it.

	if (!this.timer) {
		this.timer = setTimeout(function (that) {
			that.timer = null;
			that.timeUp();
		}, this.endTime - now, this);
	}
};


// Take a sample for which the min, max, average and standard deviation are relevant and calculate
// these before insertion into the workerData object.
Panopticon.prototype.sample = function (id, sample) {
	// Check if this sample should be in a new set.
	this.timeUp();

	if (!Number.isFinite(sample)) {
		return;
	}

	// Add data to the sample if it already exists. Otherwise initialise the sample
	if (this.data.hasOwnProperty(id)) {
		this.data[id].addSample(sample);
	} else {
		this.data[id] = new SampleTaker(sample);
	}
};


// Take a counter and increment by n if given or 1. Set up the counter if it does not already exist
// as a field in the workerData object.
Panopticon.prototype.inc = function (id, n) {
	// Check if this sample should be in a new set.
	this.timeUp();

	this.data[id] = (this.data[id] || 0) + (Number.isFinite(n) ? n : 1);
};


// Create or overwrite a field in the workerData object.
Panopticon.prototype.set = function (id, n) {
	// Check if this sample should be in a new set.
	this.timeUp();

	this.data[id] = n;
};


// Clears the interval and the timeout.
Panopticon.prototype.stop = function () {
	clearTimeout(this.halfInterval);
	clearInterval(this.aggregationInterval);
};

module.exports = Panopticon;
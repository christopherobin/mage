var EventEmitter = require('events').EventEmitter;
var cluster      = require('cluster');
var util         = require('util');


/**
 * A standard deviation object constructor. Running deviation (avoid growing arrays) which is
 * round-off error resistant.
 *
 * @param {Number} firstMeasurement
 * @constructor
 */
function StandardDeviation(firstMeasurement) {
	this.workData = firstMeasurement;
	this.lastWorkData = null;
	this.S = 0;
	this.count = 1;
}


/**
 * Add a measurement. Also calculates updates to stepwise parameters which are later used to
 * determine sigma.
 *
 * @param {Number} measurement
 */
StandardDeviation.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.lastWorkData = this.workData;
	this.workData = this.workData + (measurement - this.workData) / this.count;
	this.S = this.S + (measurement - this.lastWorkData) * (measurement - this.workData);
};


/**
 * Performs the final step needed to get the standard deviation and returns it.
 *
 * @return {Number}
 */
StandardDeviation.prototype.toJSON = function () {
	return Math.sqrt(this.S / (this.count - 1));
};


/**
 * In line with the standard deviation object, this is a very simple averaging object.
 *
 * @param {Number} firstMeasurement
 * @constructor
 */
function Average(firstMeasurement) {
	this.total = firstMeasurement;
	this.count = 1;
}


/**
 * Add a measurement. Increments the counter and updates the total.
 *
 * @param measurement
 */
Average.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.total += measurement;
};


/**
 * Simply divides the total by the number of measurements taken and returns the result.
 *
 * @return {Number}
 */
Average.prototype.toJSON = function () {
	return this.total / this.count;
};


/**
 * Sample taker object constructor.
 *
 * @param {Number} sample
 * @constructor
 */
function SampleTaker(sample) {
	this.min = sample;
	this.max = sample;
	this.standardDeviation = new StandardDeviation(sample);
	this.average = new Average(sample);
}


/**
 * Add a sample.
 *
 * @param {Number} sample
 */
SampleTaker.prototype.addSample = function (sample) {
	this.min = Math.min(this.min, sample);
	this.max = Math.max(this.max, sample);
	this.standardDeviation.addMeasurement(sample);
	this.average.addMeasurement(sample);
};


/**
 * The constructor for Panopticon. Handles the differences between master and worker processes.
 * Please refer to the README for more information.
 *
 * @param {Number} startTime
 * @param {Number} interval
 * @constructor
 */
function Panopticon(startTime, interval) {
	EventEmitter.call(this);

	// First we sort out the methods and data which handle are local to this process.
	this.genericSetup(startTime, interval);

	// If the process is a worker, we only need to send the master results then return. If the
	// process is not a worker, it is either the master or stand alone.
	if (cluster.isWorker) {
		this.workerSetup();
	} else {
		this.masterSetup();
		this.setupDelivery();
	}
}

util.inherits(Panopticon, EventEmitter);


/**
 * Set up data common to the master and worker instances of Panopticon.
 *
 * @param {number} startTime
 * @param {number} interval
 */
Panopticon.prototype.genericSetup = function (startTime, interval) {
	// Create a data container
	this.resetData();

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	this.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;

	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start =  Number.isFinite(startTime) ? startTime : 0;
	var offset = (start - now) % this.interval;

	// As startTime can be before now, we need to add an interval the so that the first end time is
	// in the future.
	this.endTime = (offset < 0) ? now + offset + this.interval : now + offset;

	// start the timer
	this.timer = null;
	this.timeUp();
};


/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 */
Panopticon.prototype.initAggregate = function () {
	if (cluster.isMaster) {
		this.aggregated = {
			numWorkers: Object.keys(cluster.workers).length,
			workers: {}
		};
	}
};


/**
 * Sets up periodic deliveries of sample sets, and reinitialises the aggregated data object.
 */
Panopticon.prototype.setupDelivery = function () {
	// Wait half an interval before beginning the delivery interval.
	var beginReporting = this.endTime + this.interval / 2;

	this.halfInterval = setTimeout(function (that) {

		// Begin reporting 0.5th intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		that.aggregationInterval = setInterval(function () {
			that.emit('delivery', that.aggregated);

			// Reset the aggregate object.
			that.initAggregate();
		}, that.interval);

	}, beginReporting, this);
};


/**
 * The data property holds all the samples for a process. This is used to initialise and reset it.
 */
Panopticon.prototype.resetData = function () {
	this.data = { pid: process.pid };
};


/**
 * Handles sample sets emitted by itself and sent to the master by workers.
 */
Panopticon.prototype.masterSetup = function () {
	// Create the basic aggregate object.
	this.initAggregate();

	// Need to pass the scope into various anonymous functions below.
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
};


/**
 * The workers simply send samples to the master.
 */
Panopticon.prototype.workerSetup = function () {
	this.on('sample', function (data) {
		process.send({ event: 'workerSample', pid: process.pid, sample: data });
	});
};


/**
 * Every time a sample is taken, or this.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset this.timer if needed.
 */
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


/**
 * Take a sample for which the min, max, average and standard deviation are relevant and calculate
 * these before insertion into the workerData object.
 *
 * @param {String} id
 * @param {Number} sample
 */
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


/**
 * Take a counter and increment by n if given or 1. Set up the counter if it does not already exist
 * as a field in the workerData object.
 *
 * @param {String} id
 * @param {Number} n
 */
Panopticon.prototype.inc = function (id, n) {
	// Check if this sample should be in a new set.
	this.timeUp();

	this.data[id] = (this.data[id] || 0) + (Number.isFinite(n) ? n : 1);
};


/**
 * Create or overwrite a field in the workerData object.
 *
 * @param {String} id
 * @param {Number} n
 */
Panopticon.prototype.set = function (id, n) {
	// Check if this sample should be in a new set.
	this.timeUp();

	this.data[id] = n;
};


/**
 * Clears the interval and the timeout.
 */
Panopticon.prototype.stop = function () {
	clearTimeout(this.halfInterval);
	clearInterval(this.aggregationInterval);
	clearTimeout(this.timer);
};

module.exports = Panopticon;
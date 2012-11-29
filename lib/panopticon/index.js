var EventEmitter = require('events').EventEmitter;
var cluster      = require('cluster');
var util         = require('util');

// id gets incremented with each new panopticon. This allows us to have multiple panoptica running
// in parallel without master panoptica getting messages from multiple panoptica on each worker.
var id = 0;


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
	this.id = id;
	id += 1;
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
 * @param {Number} val
 * @constructor
 */
function Sample(val) {
	this.min = val;
	this.max = val;
	this.sigma = new StandardDeviation(val);
	this.average = new Average(val);
}

/**
 * Add a sample.
 *
 * @param {Number} val
 */
Sample.prototype.update = function (val) {
	this.min = Math.min(this.min, val);
	this.max = Math.max(this.max, val);
	this.sigma.addMeasurement(val);
	this.average.addMeasurement(val);
};


/**
 * Increment object constructor. It keeps a copy of the interval time so that it can return the
 * increments per millisecond.
 *
 * @param {Number} val
 * @param {Number} interval
 * @constructor
 */
function Inc(val, interval) {
	this.value = val;
	this.interval = interval;
}

/**
 * Update the increment. If given no argument it defaults to adding one.
 *
 * @param {Number} val
 */
Inc.prototype.update = function (val) {
	this.value += Number.isFinite(val) ? val : 1;
};

/**
 * We do the conversion of increments per interval to increments per millisecond upon serialisation.
 *
 * @return {Number}
 */
Inc.prototype.toJSON = function () {
	return this.value / this.interval;
};


/**
 * This Set constructor exists mainly to unify the interface with Sample and Inc. The value is not
 * limited to numbers.
 *
 * @param val
 * @constructor
 */
function Set(val) {
	this.value = val;
}

/**
 * Simply replace the existing value contained in a set object.
 *
 * @param val
 */
Set.prototype.update = function (val) {
	this.value = val;
};

/**
 * Simply return the value in the value contained in a set object.
 *
 * @return {*}
 */
Set.prototype.toJSON = function () {
	return this.value;
};


/**
 * Creates paths in a data sub-object. At the end of the path initialise a new Set, Int or Sample
 * object. If one already exists, update it with the new piece of data.
 *
 * @param {Function} DataConstructor A constructor function (Set, Inc or Sample).
 * @param {Object} thisObj The object that is being augmented.
 * @param {String[]} path A list of keys of increasing depth that end in the object that will receive the id/value pair.
 * @param {String} id The key in the final sub-object in the path that will receive value.
 * @param value The value to be used by the Set, Inc or Sample at the end of the path/key chain.
 */
function augment(DataConstructor, thisObj, path, id, value) {
	var data = thisObj.data;

	if (path) {
		var i, len = path.length;

		if (len === 0) {
			return;
		}

		for (i = 0; i < len; i++) {
			var step = path[i];

			if (!data.hasOwnProperty(step)) {
				data[step] = {};
			}

			data = data[step];
		}
	}

	thisObj.timeUp(); // Check if this sample should be in a new set.

	// The data is a singleton. Create it if it doesn't exist, otherwise just update it.
	if (data[id]) {
		data[id].update(value);
	} else {
		data[id] = new DataConstructor(value, thisObj.interval);
	}
}


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
	// process is not a worker, it is either the master or stand alone. The master also handles
	// the delivery of aggregated data.
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
	var start = Number.isFinite(startTime) ? startTime : 0;
	var offset = (start - now) % this.interval;

	// If startTime is before now, we need to add an interval so that the first end time is in the
	// future. If not, we just add the offset to now.
	this.endTime = now + offset + (offset < 0) ? this.interval : 0;

	// start the timer
	this.timer = null;
	this.timeUp();
};

/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 */
Panopticon.prototype.initAggregate = function () {
	this.aggregated = {
		interval: this.interval,
		numWorkers: Object.keys(cluster.workers).length,
		workers: {}
	};
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
	var that = this;

	// Create the basic aggregate object.
	this.initAggregate();

	// Collect samples emitted by master.
	this.on('sample', function (data) {
		that.aggregated.master = data;
	});

	// Collect samples emitted by workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		cluster.workers[workerId].on('message', function (message) {
			if (message.event === 'workerSample' && message.id === that.id) {
				that.aggregated.workers[workerId] = message.sample;
			}
		});
	});
};

/**
 * The workers simply send samples to the master.
 */
Panopticon.prototype.workerSetup = function () {
	this.on('sample', function (data, id) {
		process.send({ event: 'workerSample', sample: data, id: id });
	});
};

/**
 * Every time a sample is taken, or this.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset this.timer if needed.
 */
Panopticon.prototype.timeUp = function () {
	var now = Date.now();

	if (this.endTime <= now) {
		this.data.endTime = this.endTime;

		// If we got left behind for some reason, catch up here.
		do {
			this.endTime += this.interval;
		} while (this.endTime <= now);

		// Emit the sample! Emitting the interval as well allows us to distinguish between separate
		// panoptica running in parallel.
		this.emit('sample', this.data, this.id);

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
 * @param {String[]} path
 * @param {String} id
 * @param {Number} n
 */
Panopticon.prototype.sample = function (path, id, n) {
	if (!Number.isFinite(n)) {
		return;
	}

	augment(Sample, this, path, id, n);
};

/**
 * Take a counter and increment by n if given or 1. Set up the counter if it does not already exist
 * as a field in the workerData object.
 *
 * @param {String[]} path
 * @param {String} id
 * @param {Number} n
 */
Panopticon.prototype.inc = function (path, id, n) {
	augment(Inc, this, path, id, n);
};

/**
 * Create or overwrite a field in the workerData object.
 *
 * @param {String[]} path
 * @param {String} id
 * @param {Number} n
 */
Panopticon.prototype.set = function (path, id, n) {
	augment(Set, this, path, id, n);
};

/**
 * Clears the interval and the timeout.
 */
Panopticon.prototype.stop = function () {
	clearTimeout(this.halfInterval);
	this.halfInterval = null;

	clearInterval(this.aggregationInterval);
	this.aggregationInterval = null;

	clearTimeout(this.timer);
	this.timer = null;
};


module.exports = Panopticon;
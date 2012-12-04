/** @module panopticon */
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
 * @param {Number} firstMeasurement The first measurement is used to initialise the set.
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
 * @param {Number} measurement Add a measurement to the set to calculate a standard deviation of.
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
 * @return {Number} Performs the final step needed to yield an estimate of the standard deviation.
 */
StandardDeviation.prototype.toJSON = function () {
	return Math.sqrt(this.S / (this.count - 1));
};



/**
 * In line with the standard deviation object, this is a very simple averaging object.
 *
 * @param {Number} firstMeasurement The initial measurement.
 * @constructor
 */
function Average(firstMeasurement) {
	this.total = firstMeasurement;
	this.count = 1;
}

/**
 * Add a measurement. Increments the counter and updates the total.
 *
 * @param measurement A measurement to add to the set to be averaged.
 */
Average.prototype.addMeasurement = function (measurement) {
	this.count += 1;
	this.total += measurement;
};

/**
 * Simply divides the total by the number of measurements taken and returns the result.
 *
 * @return {Number} Divides the stored total and the stored count to yield the average.
 */
Average.prototype.toJSON = function () {
	return this.total / this.count;
};



/**
 * Sample taker object constructor.
 *
 * @param {Number} val This first value is used to initialise the sample.
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
 * @param {Number} val Update the sample set.
 */
Sample.prototype.update = function (val) {
	this.min = Math.min(this.min, val);
	this.max = Math.max(this.max, val);
	this.sigma.addMeasurement(val);
	this.average.addMeasurement(val);
};



/**
 * Timed sample object constructor.
 *
 * @param {Number[2]} dt Takes the output of a diff produced by feeding the result of one hrtime as the parameter to another.
 * @param {null} interval This variable is not used, but required to make it interchageable with other functions.
 * @param {Number} scaleFactor The scale factor for time calculations. 1 -> 1kHz, 1000 -> 1Hz.
 * @constructor
 */
function TimedSample(dt, interval, scaleFactor) {
	var time = (hrDiff[0] + hrDiff[1] / 1e9) * 1000 / scaleFactor;

	this.scaleFactor = scaleFactor;
	this.min = time;
	this.max = time;
	this.sigma = new StandardDeviation(time);
	this.average = new Average(time);
}

/**
 * Add a time sample.
 *
 * @param  {Number[2]} dt Add an hrtime difference sample.
 */
TimedSample.prototype.update = function (dt) {
	var time = (hrDiff[0] + hrDiff[1] / 1e9) * 1000 / this.scaleFactor;

	this.min = Math.min(this.min, time);
	this.max = Math.max(this.max, time);
	this.sigma.addMeasurement(time);
	this.average.addMeasurement(time);
};



/**
 * Increment object constructor. It keeps a copy of the interval time so that it can return the
 * increments per millisecond.
 *
 * @param {Number} val Value to initialise the increment. If not a finite number, defaults to 1.
 * @param {Number} interval This interval over which increments are to be taken.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 * @constructor
 */
function Inc(val, interval, scaleFactor) {
	this.value = Number.isFinite(val) ? val : 1;
	this.interval = interval;
	this.scaleFactor = scaleFactor;
}

/**
 * Update the increment. If given no argument it defaults to adding one.
 *
 * @param {Number} val Increment by val, or 1 if val is not a finite number.
 */
Inc.prototype.update = function (val) {
	this.value += Number.isFinite(val) ? val : 1;
};

/**
 * We do the conversion of increments per interval to increments per millisecond upon serialisation.
 *
 * @return {Number} Divides the internal state of the increment by the intervat and yields.
 */
Inc.prototype.toJSON = function () {
	return this.scaleFactor * this.value / this.interval;
};



/**
 * This Set constructor exists mainly to unify the interface with Sample and Inc. The value is not
 * limited to numbers.
 *
 * @param val Simply sets the internal state to val.
 * @constructor
 */
function Set(val) {
	this.value = val;
}

/**
 * Simply replace the existing value contained in a set object.
 *
 * @param val Reset the internal state to val.
 */
Set.prototype.update = function (val) {
	this.value = val;
};

/**
 * Simply return the value in the value contained in a set object.
 *
 * @return {*} Returns the stored value.
 */
Set.prototype.toJSON = function () {
	return this.value;
};



/**
 * The data property holds all the samples for a process. This is used to initialise and reset it.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function resetData(thisObj) {
	thisObj.data = { pid: process.pid };
}


/**
 * Every time a sample is taken, or thisObj.timer fires, this function checks if it is time to emit
 * a sample yet (and reset after emission), and to reset thisObj.timer if needed.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function timeUp(thisObj) {
	var now = Date.now();

	if (thisObj.endTime <= now) {
		thisObj.data.endTime = thisObj.endTime;

		// If we got left behind for some reason, catch up here.
		do {
			thisObj.endTime += thisObj.interval;
		} while (thisObj.endTime <= now);

		// Emit the sample! Emitting the interval as well allows us to distinguish between separate
		// panoptica running in parallel.
		thisObj.emit('sample', thisObj.data, thisObj.id);

		// Reset the data.
		resetData(thisObj);

		// Reset the timeout.
		if (thisObj.timer) {
			clearTimeout(thisObj.timer);
			thisObj.timer = null;
		}
	}

	// Recreate the timer if it's not running. The node.js timers have a bug which allows a timeout
	// to fire early sometimes. If that happens then the above evaluates to false, but the below
	// resets the timer, thus handling the issue. If the timer legitimately fires, then the below
	// acts to reset it.

	if (!thisObj.timer) {
		thisObj.timer = setTimeout(function () {
			thisObj.timer = null;
			timeUp(thisObj);
		}, thisObj.endTime - now);
	}
}


/**
 * Creates paths in a data sub-object. At the end of the path initialise a new Set, Int or Sample
 * object. If one already exists, update it with the new piece of data.
 *
 * @param {Object} thisObj The object that is being augmented.
 * @param {Function} DataConstructor A constructor function (Set, Inc or Sample).
 * @param {String[]} path A list of keys of increasing depth that end in the object that will receive the id/value pair.
 * @param {String} id The key in the final sub-object in the path that will receive value.
 * @param value The value to be used by the Set, Inc or Sample at the end of the path/key chain.
 */
function augment(thisObj, DataConstructor, path, id, value) {
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

	timeUp(thisObj); // Check if this sample should be in a new set.

	// The data is a singleton. Create it if it doesn't exist, otherwise just update it.
	if (data[id]) {
		data[id].update(value);
	} else {
		data[id] = new DataConstructor(value, thisObj.interval, thisObj.scaleFactor);
	}
}


/**
 * Set up data common to the master and worker instances of Panopticon.
 *
 * @param {Object} thisObj The scope to operate on.
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz.
 */
function genericSetup(thisObj, startTime, interval, scaleFactor) {
	// Create a data container
	resetData(thisObj);

	// Set the interval from given data. If no sane interval provided, default to 10 seconds.
	thisObj.interval = Number.isFinite(interval) && interval > 0 ? interval : 10000;
	thisObj.scaleFactor = scaleFactor;

	// Generate an endTime, at which we deliver the sample. If no startTime was given, we use 0.
	var now = Date.now();

	// If no start time was given, or if it was not a finite number, use zero.
	var start = Number.isFinite(startTime) ? startTime : 0;
	var offset = (start - now) % thisObj.interval;

	// If startTime is before now, we need to add an interval so that the first end time is in the
	// future. If not, we just add the offset to now.
	thisObj.endTime = now + offset + (offset < 0) ? thisObj.interval : 0;

	// start the timer
	thisObj.timer = null;
	timeUp(thisObj);
}


/**
 * For master only. This object will contain the aggregated data from the master and the workers.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function initAggregate(thisObj) {
	thisObj.aggregated = {
		id: thisObj.id,
		interval: thisObj.interval,
		numWorkers: Object.keys(cluster.workers).length,
		workers: {}
	};
}


/**
 * Sets up periodic deliveries of sample sets, and reinitialises the aggregated data object.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function setupDelivery(thisObj) {
	// Wait half an interval before beginning the delivery interval.
	var beginReporting = thisObj.endTime + thisObj.interval / 2;

	thisObj.halfInterval = setTimeout(function () {

		// Begin reporting 0.5th intervals after the first endTime. This way reports are emitted
		// well away from when batches are collected.
		thisObj.aggregationInterval = setInterval(function () {
			thisObj.emit('delivery', thisObj.aggregated);

			// Reset the aggregate object.
			initAggregate(thisObj);
		}, thisObj.interval);

	}, beginReporting);
}


/**
 * Handles sample sets emitted by itself and sent to the master by workers.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function masterSetup(thisObj) {
	// Create the basic aggregate object.
	initAggregate(thisObj);

	// Collect samples emitted by master.
	thisObj.on('sample', function (data) {
		thisObj.aggregated.master = data;
	});

	// Collect samples emitted by workers.
	Object.keys(cluster.workers).forEach(function (workerId) {
		cluster.workers[workerId].on('message', function (message) {
			if (message.event === 'workerSample' && message.id === thisObj.id) {
				thisObj.aggregated.workers[workerId] = message.sample;
			}
		});
	});
}


/**
 * The workers simply send samples to the master.
 *
 * @param {Object} thisObj The scope to operate on.
 */
function workerSetup(thisObj) {
	thisObj.on('sample', function (data, id) {
		process.send({ event: 'workerSample', sample: data, id: id });
	});
}


/**
 * The constructor for Panopticon. Handles the differences between master and worker processes.
 * Please refer to the README for more information.
 *
 * @param {Number} startTime Time in milliseconds elapsed since 1 January 1970 00:00:00 UTC.
 * @param {Number} interval Interval time in milliseconds.
 * @param {Number} scaleFactor 1 -> kHz, 1000 -> Hz
 * @constructor
 * @extends require('events').EventEmitter
 * @alias module:panopticon
 */
function Panopticon(startTime, interval, scaleFactor) {
	EventEmitter.call(this);

	// First we sort out the methods and data which handle are local to this process.
	genericSetup(this, startTime, interval, scaleFactor || 1);

	// If the process is a worker, we only need to send the master results then return. If the
	// process is not a worker, it is either the master or stand alone. The master also handles
	// the delivery of aggregated data.
	if (cluster.isWorker) {
		workerSetup(this);
	} else {
		masterSetup(this);
		setupDelivery(this);
	}

	this.id = id;

	id += 1;
}

util.inherits(Panopticon, EventEmitter);

/**
 * Take a sample for which the min, max, average and standard deviation are relevant and calculate
 * these before insertion into the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number} n The number to sample.
 */
Panopticon.prototype.sample = function (path, id, n) {
	if (!Number.isFinite(n)) {
		return;
	}

	augment(this, Sample, path, id, n);
};

/**
 * Use the Δt array representing the difference between two readings process.hrtime():
 * var diff = process.hrtime(start);
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number[2]} dt Output from process.hrtime().
 */
Panopticon.prototype.timedSample = function (path, id, dt) {
	if (!Array.isArray(timeDiff)) {
		return;
	}

	augment(this, TimedSample, path, id, dt);
};

/**
 * Take a counter and increment by n if given or 1. Set up the counter if it does not already exist
 * as a field in the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to within the address defined by path.
 * @param {Number} n Increment the addressed data by n. If this is the initial increment, treat the addressed data as 0.
 */
Panopticon.prototype.inc = function (path, id, n) {
	augment(this, Inc, path, id, n);
};

/**
 * Create or overwrite a field in the workerData object.
 *
 * @param {String[]} path Addresses the data object, with each element down a level from the one before it.
 * @param {String} id A key to assign data to.
 * @param {} n Data to set. This is not restricted to numbers.
 */
Panopticon.prototype.set = function (path, id, n) {
	augment(this, Set, path, id, n);
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

/**
 * Static method returns the number of panoptica instances.
 *
 * @return {Number}
 */
Panopticon.count = function () {
	return id;
};


module.exports = Panopticon;
/** @module HeartBeat */
var util = require('util');
var Schedule = require('./Schedule');
var Duration = require('./Duration');

/**
 * HeartBeat constructor function.
 *
 * @param {Duration} period
 * @param {Date} start
 * @param {Date} end
 * @constructor
 * @extends Schedule
 * @alias module:HeartBeat
 */

function HeartBeat(period, start, end) {
	var isString = Object.prototype.toString.call(period) === "[object String]";

	if (isString && period.length > 0 && (period[0] === '"' || period[0] === '{')) {
		try {
			period = JSON.parse(period);
		} catch (e) {}
	}

	var isObject = Object.prototype.toString.call(period) === "[object Object]";

	if (isObject) {
		// If provided, start and end have precedence over period.start and period.end
		start = start || period.start;
		end = end || period.end;
		period = period.period;
	}

	if (period === undefined) {
		// Not a serialized HeartBeat
		return undefined;
	}

	Schedule.call(this, start, end);

	Object.defineProperty(this, 'period', {
		enumerable: true,
		writable: false,
		value: new Duration(period)
	});
}

util.inherits(HeartBeat, Schedule);

/**
 * Is this heartBeat valid?
 *
 * @return {Boolean}
 */

HeartBeat.prototype.isInvalid = function () {
	return Schedule.prototype.isInvalid.call(this) || !!(!this.period || this.period.isInvalid());
};


/**
 * Yield the next event. Can be based on an optional last event.
 *
 * @param {Date} [last]
 * @return {Date}
 */

HeartBeat.prototype.getNextEvent = function (last) {
	var period = +(this.period);

	return Schedule.prototype.getNextEvent.call(this, last, function (next) {
		// next may be a Date instance. + casts it to an integer.
		next = (+next) + 1;
		var mod = next % period;
		return new Date(next + (mod ? period - mod : mod));
	});
};

// Expose the constructor as the module.
module.exports = HeartBeat;

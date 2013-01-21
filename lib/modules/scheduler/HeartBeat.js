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

var HeartBeat = function (period, start, end) {
	if (Object.prototype.toString.call(period) === "[object String]" &&
		period.length > 0 &&
		(period[0] === '"' || period[0] === '{')
	) {
		try {
			period = JSON.parse(period);
		} catch (ignore) { }
	}

	if (Object.prototype.toString.call(period) === "[object Object]") {
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

	if (period !== undefined) {
		Object.defineProperty(this, 'period', { enumerable: true, writable: false, value: new Duration(period) });
	}
};

util.inherits(HeartBeat, Schedule);

HeartBeat.prototype.isInvalid = function () {
	return Schedule.prototype.isInvalid.apply(this) || !!(!this.period || this.period.isInvalid());
};

HeartBeat.prototype.getNextEvent = function (last) {
	var period = +this.period;

	return Schedule.prototype.getNextEvent.apply(this, [last, function (next) {
		++next;
		var mod = +next % period;
		return new Date(+next + (mod ? period - mod : mod));
	}.bind(this)]);
};

// Expose the constructor as the module.
module.exports = HeartBeat;

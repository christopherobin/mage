"use strict";

var Schedule = require('./schedule'),
	Duration = require('./duration');

/**
 * HearBeat object constructor.
 *
 * @this {HeartBeat}
 * @param {Duration} period
 * @param {Date} start
 * @param {Date} end
 * @return {HeartBeat}
 * @api public
 *
 */
var HeartBeat = function HeartBeat(period, start, end) {
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

	Schedule.prototype.constructor.apply(this, [start, end]);

	if (period !== undefined) {
		Object.defineProperty(this, 'period', {enumerable: true, writable: false, value: new Duration(period)});
	}
};

HeartBeat.prototype = Object.create(Schedule.prototype);

HeartBeat.prototype.constructor = HeartBeat;

/**
 * Check the HeartBeat's validity.
 *
 * @override
 * @this {HeartBeat}
 * @return {boolean} true if invalid, false otherwise.
 */
HeartBeat.prototype.isInvalid = function () {
	return Schedule.prototype.isInvalid.apply(this) || !!(!this.period || this.period.isInvalid());
};

/**
 * Set's the HeartBeat to its next due date and return that.
 *
 * @override
 * @this {HeartBeat}
 * @return {Date} Next due date, or null if none was found.
 */
HeartBeat.prototype.getNextEvent = function (last) {
	var period = +this.period;

	return Schedule.prototype.getNextEvent.apply(this, [last, function (next) {
		++next;
		var mod = +next % period;
		return new Date(+next + (mod ? period - mod : mod));
	}.bind(this)]);
};

module.exports = HeartBeat;
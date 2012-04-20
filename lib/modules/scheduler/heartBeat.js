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
var HeartBeat = function (period, start, end) {
	Schedule.prototype.constructor.apply(this, []);

	if (arguments.length === 1) {
		if (Object.prototype.toString.call(period) === "[object String]") {
			// Parse JSON string
			try {
				var obj = JSON.parse(period);
				if (obj.period) {
					period = obj.period;
					start = obj.start;
					end = obj.end;
				}
			} catch (e) { }
		} else if (period instanceof HeartBeat) {
			// Copy
			for (var prop in period) {
				if (!period.hasOwnProperty(prop)) {
					continue;
				}
				this[prop] = period[prop];
			}
			return undefined;
		}
	}

	var invalid;

	if (period !== undefined) {
		this.period = new Duration(period);
		invalid = invalid || this.period.isInvalid();
	}

	if (start !== undefined && start !== null && !invalid) {
		this.start = new Date(start);
		invalid = invalid || isNaN(this.start.valueOf());
	}

	if (end !== undefined && end !== null && !invalid) {
		this.end = new Date(end);
		invalid = invalid || isNaN(this.end.valueOf());
	}

	if (invalid) {
		delete this.period;
		delete this.start;
		delete this.end;
	}
};

HeartBeat.prototype = Object.create(Schedule.prototype);
HeartBeat.prototype.constructor = HeartBeat;

/**
 * Set's the HeartBeat to its next due date and return that.
 *
 * @override
 * @this {HeartBeat}
 * @return {Date} Next due date, or null if none was found.
 */
HeartBeat.prototype.getNextEvent = function (last) {
	if (this.isInvalid()) {
		return null;
	}

	if (last === undefined) {
		this.next = this.next || new Date(Date.now());
	} else {
		// handles Date, Number, String, JSON...
		last = last && +new Date(last);
		last = last && (1 + (+last));
		if (!isNaN(last)) {
			this.next = new Date(last);
		}
	}

	if (!this.next) {
		return null;
	}

	if (this.start > this.next) {
		this.next.setTime(+this.start);
	}

	var period = +this.period,
		mod = +this.next % period,
		next = new Date(+this.next + (mod ? period - mod : mod));

	this.next = (new Date(this.end) < next || isNaN(+next)) ? null : next;
	return this.next;
};

/**
 * Serialize the HeartBeat to JSON.
 *
 * @override
 * @this {HeartBeat}
 * @return {string} JSON representation of this HeartBeat.
 */
HeartBeat.prototype.toJSON = function () {
	if (this.isInvalid()) {
		return 'Invalid HeartBeat';
	}

	var obj = {};
	if (this.period !== undefined) {
		obj.period = this.period;
	}
	if (this.start !== undefined) {
		obj.start = this.start;
	}
	if (this.end !== undefined) {
		obj.end = this.end;
	}

	return obj;
};

/**
 * Check the HeartBeat's validity.
 *
 * @override
 * @this {HeartBeat}
 * @return {boolean} true if invalid, false otherwise.
 */
HeartBeat.prototype.isInvalid = function () {
	return this.period === undefined;
};

module.exports = HeartBeat;

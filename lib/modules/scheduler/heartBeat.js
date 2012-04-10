"use strict";

var Schedule = require('./schedule'),
	Duration = require('./duration');

/**
 * HearBeat object constructor.
 *
 * @param {Duration} period
 * @param {Date} start
 * @param {Date} end
 * @return {HeartBeat}
 *
 */
var HeartBeat = function (period, start, end) {
	Schedule.prototype.constructor.apply(this, []);

	// Parse JSON string
	if (typeof period === "string" && arguments.length === 1) {
		try {
			var obj = JSON.parse(period);
			if (obj.period) {
				period = obj.period;
				start = obj.start;
				end = obj.end;
			}
		} catch (e) { }
	}

	var invalid;

	if (typeof period !== "undefined") {
		this.period = new Duration(period);
		invalid = invalid || this.period.isInvalid();
	}

	if (typeof start !== "undefined" && start !== null && !invalid) {
		this.start = new Date(start);
		invalid = invalid || isNaN(this.start.valueOf());
	}

	if (typeof end !== "undefined" && end !== null && !invalid) {
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
HeartBeat.prototype.getNextEvent = function (last) {
	if (this.isInvalid()) {
		return null;
	}

	if (typeof last === "undefined") {
		this.next = this.next || new Date(Date.now());
	} else {
		// handles undefined, null, Date, Number, String, JSON...
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

HeartBeat.prototype.isInvalid = function () {
	return this.period === undefined;
};

module.exports = HeartBeat;

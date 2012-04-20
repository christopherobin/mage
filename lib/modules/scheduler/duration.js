"use strict";

var DURATION_RE = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?$/;

/**
 * Duration object constructor.
 *
 * Durations are specified either as a number of milliseconds or as a string,
 * following the format [<days>d][<hours>h][<minutes>m][<seconds>s][<ms>ms].
 *
 * Examples:
 *     8d7s      8 days and 7 seconds
 *     1s500ms   1.5 second
 *     2d12h     2.5 days
 *     10h25m    10 hours and 25 minutes
 *
 * @param {String} value Value in milliseconds or duration spec string.
 * @return {Duration}
 * @api public
 */
var Duration = function (value) {
	var m, undef;

	// Parse JSON
	if (Object.prototype.toString.call(value) === "[object String]" && value.slice(0, 1) === '"') {
		try {
			value = JSON.parse(value);
		} catch (e) {
			value = undef;
		}
	}

	this.milliseconds = Number(value);
	if (isNaN(this.milliseconds)) {
		if (value instanceof Duration) {
			// Copy
			this.value = value.value;
			this.milliseconds = value.milliseconds;
		} else if (Object.prototype.toString.call(value) === "[object String]" && (m = DURATION_RE.exec(value))) {
			// Parse duration string
			this.value = value;
			this.milliseconds = Number(m[1]) || 0; // days
			this.milliseconds *= 24;
			this.milliseconds += Number(m[2]) || 0; // hours
			this.milliseconds *= 60;
			this.milliseconds += Number(m[3]) || 0; // minutes
			this.milliseconds *= 60;
			this.milliseconds += Number(m[4]) || 0; // seconds
			this.milliseconds *= 1000;
			this.milliseconds += Number(m[5]) || 0; // milliseconds
		}
	}

	// Durations are positive integers
	if (!isNaN(this.milliseconds)) {
		this.milliseconds = this.milliseconds | 0;
		this.milliseconds = this.milliseconds >= 0 ? this.milliseconds : Number.NaN;
	}

	// Create the string version if it doesn't exist already
	if (this.isInvalid()) {
		this.value = "Illegal Duration";
	} else if (typeof this.value === "undefined") {
		var val = this.milliseconds, res = [];

		res.unshift(val % 1000);
		val -= res[0];
		val /= 1000;
		res.unshift(val % 60);
		val -= res[0];
		val /= 60;
		res.unshift(val % 60);
		val -= res[0];
		val /= 60;
		res.unshift(val % 24);
		val -= res[0];
		val /= 24;
		res.unshift(val);

		res[0] += "d";
		res[1] += "h";
		res[2] += "m";
		res[3] += "s";
		res[4] += "ms";

		// filter zero values out
		res = res.filter(function (value) {
			return value[0] !== "0";
		}).join('');

		// if all got filtered out it means value was 0 (which is valid)
		this.value = res || "0ms";
	}
};

Duration.prototype = {
	constructor: Duration,
	toString: function () {
		return this.value;
	},
	toJSON: function () {
		return this.toString();
	},
	valueOf: function () {
		return this.milliseconds;
	},
	isInvalid: function () {
		return isNaN(this.milliseconds);
	}
};

module.exports = Duration;

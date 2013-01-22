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
var Duration = function Duration(value) {
	var m, parsed;

	// Parse JSON
	if (Object.prototype.toString.call(value) === "[object String]" && value.slice(0, 1) === '"') {
		try {
			value = JSON.parse(value);
		} catch (e) {
			value = undefined;
		}
	}

	parsed = Number(value);
	if (isNaN(parsed)) {
		if (value instanceof Duration && !value.isInvalid()) {
			// Copy
			Object.defineProperty(this, 'value', {enumerable: true, writable: false, value: value.value});
			Object.defineProperty(this, 'milliseconds', {enumerable: false, writable: false, value: value.milliseconds});
		} else if (Object.prototype.toString.call(value) === "[object String]" && (m = DURATION_RE.exec(value))) {
			// Parse duration string
			parsed = Number(m[1]) || 0; // days
			parsed *= 24;
			parsed += Number(m[2]) || 0; // hours
			parsed *= 60;
			parsed += Number(m[3]) || 0; // minutes
			parsed *= 60;
			parsed += Number(m[4]) || 0; // seconds
			parsed *= 1000;
			parsed += Number(m[5]) || 0; // milliseconds
			Object.defineProperty(this, 'value', {enumerable: true, writable: false, value: value});
			Object.defineProperty(this, 'milliseconds', {enumerable: false, writable: false, value: parsed});
		}
	} else if (parsed >= 0) {
		Object.defineProperty(this, 'milliseconds', {enumerable: false, writable: false, value: parsed});
	}

	// Create the string version if it doesn't exist already
	if (this.value === undefined && this.milliseconds !== undefined) {
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
		Object.defineProperty(this, 'value', {enumerable: true, writable: false, value: res || "0ms"});
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
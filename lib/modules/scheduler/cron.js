"use strict";

var	Schedule = require('./schedule'),
	ONE_SECOND = 1000,
	ONE_MINUTE = 60 * ONE_SECOND,
	ONE_HOUR = 60 * ONE_MINUTE,
	ONE_DAY = 24 * ONE_HOUR,
	SPACE_RE = /\s+/,
	NAME_RE = /^[a-z]{3}\b/,
	FIELD_ITEM_RE = /^(?:(?:(\d+)-(\d+)|(\*))(?:\/(\d+))?|(\d+))/,
	FIELD_RE = new RegExp(/^field(,field)*$/.source.replace(/field/g, FIELD_ITEM_RE.source.replace(/^\^/, ''))),
	FIELD_NAMES = ['seconds', 'minutes', 'hours', 'dotm', 'months', 'dotw'],
	SPECS = [
		// seconds
		{ range: [ 0, 59 ] },
		// minutes
		{ range: [ 0, 59 ] },
		// hours
		{ range: [ 0, 23 ] },
		// days of the month
		{ range: [ 1, 31 ] },
		// months
		{
			range: [ 1, 12 ],
			names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
		},
		// days of the week
		{
			range: [ 0, 7 ],
			names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
		}
	];

/**
 * Creates an instance of Cron.
 *
 * @constructor
 * @this {Cron}
 * @param {String} crontab
 * @api public
 *
 * Example usage:
 *
 * // Note: escaping / is not required in code, but a / following a * cannot properly be commented out.
 * var cron = new Cron("0 *\/10,3 12-14,17 10-14/2,4 jul wed");
 *
 * // Execute something every second:
 * var times = 0, cron = new Cron("* * * * *")
 * cron.on('run', function () {
 *     console.log("Executed " + (++times) + " times");
 * });
 *
 */
var Cron = function Cron(crontab, start, end) {
	if (Object.prototype.toString.call(crontab) === "[object String]" &&
		crontab.length > 0 &&
		(crontab[0] === '"' || crontab[0] === '{')
	) {
		try {
			crontab = JSON.parse(crontab);
		} catch (ignore) { }
	}

	if (Object.prototype.toString.call(crontab) === "[object Object]") {
		// If provided, start and end have precedence over period.start and period.end
		start = start || crontab.start;
		end = end || crontab.end;
		crontab = crontab.crontab;
	}

	if (crontab === undefined) {
		// Not a serialized Cron
		return undefined;
	}

	Schedule.prototype.constructor.apply(this, [start, end]);

	var self = this,
		cr = crontab.toLowerCase().split(SPACE_RE),
		parsing_failed;

	// A crontab must be at least 5 elements and at most 6.
	if (cr.length < 5 || cr.length > 6) {
		return undefined;
	}

	// If no day of the week is provided, create an empty map
	if (cr.length === 5) {
		Object.defineProperty(self, 'dotw', {enumerable: false, writable: false, value: {}});
	}

	FIELD_NAMES.forEach(function (field_name, i) {
		var rem = cr[i],
			min_start = SPECS[i].range[0],
			max_end = SPECS[i].range[1],
			names = SPECS[i].names,
			m,
			prop = {};

		if (rem === undefined && i === 5) {
			return undefined;
		}

		if ((m = FIELD_RE.exec(rem))) {
			// comma-separated list of field items
			while ((m = FIELD_ITEM_RE.exec(rem))) {
				rem = rem.slice(m[0].length);

				var start = Number(m[1]),
					end = Number(m[2]),
					wildcard = m[3],
					step = Number(m[4]) || 1,
					value = Number(m[5]);

				if (wildcard) {
					start = min_start;
					end = max_end;
				} else if (!isNaN(value)) {
					start = Number(value);
					end = start;
				}

				if (start < min_start ||
					end > max_end ||
					start > end ||
					step > (1 + end - start) ||
					(rem.length && rem[0] !== ",")
				) {
					parsing_failed = true;
					break;
				}

				// assign new values
				for (var x = start; x <= end; x += step) {
					prop[x] = true;
				}

				// skip comma
				rem = rem.slice(1);
			}
		} else if (names && ((m = NAME_RE.exec(rem)))) {
			rem = rem.slice(m[0].length);
			prop[names[m[0]]] = true;
		} else {
			parsing_failed = true;
		}
		Object.defineProperty(self, field_name, {enumerable: false, writable: false, value: prop});
	});

	if (!parsing_failed) {
		Object.defineProperty(this, 'crontab', {enumerable: true, writable: false, value: crontab});
	}
};

Cron.prototype = Object.create(Schedule.prototype);

Cron.prototype.constructor = Cron;

/**
* Check the Cron's validity.
*
* @override
* @this {Cron}
* @return {boolean} true if invalid, false otherwise.
*/
Cron.prototype.isInvalid = function () {
	return Schedule.prototype.isInvalid.apply(this) || this.crontab === undefined;
};

/**
* Set's the Cron to its next due date and return that.
*
* @override
* @this {Cron}
* @return {Date} Next due date, or null if none was found.
*/
Cron.prototype.getNextEvent = function (last) {
	return Schedule.prototype.getNextEvent.apply(this, [last, function (next) {
		// Find next event
		// We're guaranteed to exit this loop because crontabs repeat themselves
		// at least once every height years.
		next.setMilliseconds(0);
		next.setTime(+next + ONE_SECOND);

		while (true) {
			// loop while we're not on the right month
			if (!this.months[next.getMonth() + 1]) {
				// Add one month to current date
				var newMonth = (next.getMonth() + 1) % 12;
				// Adjust year if it warped
				if (!newMonth) {
					next.setFullYear(next.getFullYear() + 1);
				}
				next.setMonth(newMonth);

				// Reset lower units
				next.setDate(1);
				next.setHours(0);
				next.setMinutes(0);
				next.setSeconds(0);
				continue;
			}

			// loop while we're not on the right day
			if (!this.dotm[next.getDate()] && !this.dotw[next.getDay()]) {
				// Add 1d to current date,
				// + 1h to accomodate DST changes
				next.setTime(+next + ONE_DAY + ONE_HOUR);

				// Reset lower units
				next.setHours(0);
				next.setMinutes(0);
				next.setSeconds(0);
				continue;
			}

			// loop while we're not on the right hour
			if (!this.hours[next.getHours()]) {
				// Add 1h to current date
				next.setTime(+next + ONE_HOUR);

				// Reset lower units
				next.setMinutes(0);
				next.setSeconds(0);
				continue;
			}

			// loop while we're not on the right minute
			if (!this.minutes[next.getMinutes()]) {
				// Add 1m to current date
				// + 1s to accomodate leap seconds
				next.setTime(+next + ONE_MINUTE + ONE_SECOND);

				// Reset lower units
				next.setSeconds(0);
				continue;
			}

			// loop while we're not on the right second
			if (!this.seconds[next.getSeconds()]) {
				// Add 1s to current date
				next.setTime(+next + ONE_SECOND);
				continue;
			}

			break;
		}

		return new Date(next);
	}.bind(this)]);
};

module.exports = Cron;
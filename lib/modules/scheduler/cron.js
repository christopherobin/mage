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
			names: { jan: 1, feb: 2, mar: 3, avr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
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
 * var times = 0, cron = new Cron("* * * * * *")
 * cron.on('run', function () {
 *     console.log("Executed " + (++times) + " times");
 * });
 *
 */
var Cron = function (crontab) {
	Schedule.prototype.constructor.apply(this, []);

	var cr,
		properties = {},
		parsing_failed;

	if (crontab instanceof Cron) {
		for (var prop in crontab) {
			if (!crontab.hasOwnProperty(prop)) {
				continue;
			}
			this[prop] = crontab[prop];
		}
		return undefined;
	}

	if (typeof crontab !== "string") {
		return undefined;
	}

	if (crontab[0] === '"') {
		try {
			crontab = JSON.parse(crontab);
		} catch (e) {
			return undefined;
		}
	}

	cr = crontab.toLowerCase().split(SPACE_RE);

	if (cr.length < 5) {
		return undefined;
	}

	FIELD_NAMES.forEach(function (field_name, i) {
		var rem = cr[i],
			min_start = SPECS[i].range[0],
			max_end = SPECS[i].range[1],
			names = SPECS[i].names,
			m;

		properties[field_name] = {};

		if (cr[i] === undefined && i === 5) {
			return undefined;
		}

		if ((m = FIELD_RE.exec(cr[i]))) {
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
					properties[field_name][x] = true;
				}

				// skip comma
				rem = rem.slice(1);
			}
		} else if (names && ((m = NAME_RE.exec(rem)))) {
			rem = rem.slice(m[0].length);
			properties[field_name][names[m[0]]] = true;
		} else {
			parsing_failed = true;
		}
	});

	if (!parsing_failed) {
		// parsing ok!
		this.crontab = crontab;
		for (var k in properties) {
			this[k] = properties[k];
		}
	}
};

Cron.prototype = Object.create(Schedule.prototype);
Cron.prototype.constructor = Cron;

/**
 * Find a String representation of the Cron.
 *
 * @override
 * @this {Cron}
 * @return {string} String representation of this Cron.
 */
Cron.prototype.toString = function () {
	return this.isInvalid() ? "Invalid Cron" : this.crontab;
};

/**
 * Serialize the Cron to JSON.
 *
 * @override
 * @this {Cron}
 * @return {string} JSON representation of this Cron.
 */
Cron.prototype.toJSON = function () {
	return this.toString();
};

/**
 * Check the Cron's validity.
 *
 * @override
 * @this {Cron}
 * @return {boolean} true if invalid, false otherwise.
 */
Cron.prototype.isInvalid = function () {
	return typeof this.crontab === "undefined";
};

/**
 * Set's the Cron to its next due date and return that.
 *
 * @override
 * @this {Cron}
 * @return {Date} Next due date, or null if none was found.
 */
Cron.prototype.getNextEvent = function (last) {
	if (this.isInvalid()) {
		return null;
	}

	this.next = this.next || new Date();

	if (last instanceof Date) {
		// Step 1 second from last
		this.next.setTime(+last + 1000);
	} else {
		this.next.setMilliseconds(0);
	}

	// Find next event
	// We're guaranteed to exit this loop because crontabs repeat themselves
	// at least once every height years.
	while (true) {
		// loop while we're not on the right month
		if (!this.months[this.next.getMonth() + 1]) {
			// Add one month to current date
			var newMonth = (this.next.getMonth() + 1) % 12;
			// Adjust year if it warped
			if (!newMonth) {
				this.next.setFullYear(this.next.getFullYear() + 1);
			}
			this.next.setMonth(newMonth);

			// Reset lower units
			this.next.setDate(1);
			this.next.setHours(0);
			this.next.setMinutes(0);
			this.next.setSeconds(0);
			continue;
		}

		// loop while we're not on the right day
		if (!this.dotm[this.next.getDate()] && !this.dotw[this.next.getDay()]) {
			// Add 1d to current date,
			// + 1h to accomodate DST changes
			this.next.setTime(+this.next + ONE_DAY + ONE_HOUR);

			// Reset lower units
			this.next.setHours(0);
			this.next.setMinutes(0);
			this.next.setSeconds(0);
			continue;
		}

		// loop while we're not on the right hour
		if (!this.hours[this.next.getHours()]) {
			// Add 1h to current date
			this.next.setTime(+this.next + ONE_HOUR);

			// Reset lower units
			this.next.setMinutes(0);
			this.next.setSeconds(0);
			continue;
		}

		// loop while we're not on the right minute
		if (!this.minutes[this.next.getMinutes()]) {
			// Add 1m to current date
			// + 1s to accomodate leap seconds
			this.next.setTime(+this.next + ONE_MINUTE + ONE_SECOND);

			// Reset lower units
			this.next.setSeconds(0);
			continue;
		}

		// loop while we're not on the right second
		if (!this.seconds[this.next.getSeconds()]) {
			// Add 1s to current date
			this.next.setTime(+this.next + ONE_SECOND);
			continue;
		}

		break;
	}

	// Return a copy of this.next
	return new Date(this.next);
};

module.exports = Cron;

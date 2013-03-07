/** @module Schedule */
var EventEmitter = require('events').EventEmitter;
var util = require('util');


/**
 * Scheduler constructor function.
 *
 * @param {Number|String} start
 * @param {Number|String} end
 * @constructor
 * @extends EventEmitter
 * @alias module:Schedule
 */

function Schedule(start, end) {
	EventEmitter.call(this);

	Object.defineProperty(this, 'locked', { enumerable: false, writable: true, value: false });
	Object.defineProperty(this, 'timer', { enumerable: false, writable: true, value: null });
	Object.defineProperty(this, 'next', { enumerable: false, writable: true });

	if (start !== undefined && start !== null) {
		Object.defineProperty(this, 'start', { enumerable: true, writable: false, value: new Date(start) });
	}

	if (end !== undefined && end !== null) {
		Object.defineProperty(this, 'end', { enumerable: true, writable: false, value: new Date(end) });
	}
}

util.inherits(Schedule, EventEmitter);


/**
 * Attempt to start a schedule instance. This checks that an instance is valid and then calls spool.
 */

Schedule.prototype.run = function () {
	if (this.isInvalid()) {
		this.emit('error', 'Invalid Schedule');
	} else if (this.timer === null) {
		this.locked = false;
		this.spool();
	}
};


/**
 * Cancel a schedule instance. Clears the timeout (if any) for the next scheduled event.
 */

Schedule.prototype.cancel = function () {
	this.locked = true;

	if (this.timer) {
		clearTimeout(this.timer);
		this.timer = null;
	}

	this.emit('cancel');
};


/**
 * Checks the next event. If it is now or before now it fires the event now. Otherwise, it sets a
 * timeout to fire the event in the future, and call this function again to handle the next
 * scheduled event.
 */

Schedule.prototype.spool = function () {
	var next = this.getNextEvent();

	if (!next) {
		this.emit('end');
		return;
	}

	var timeout = next - Date.now();
	timeout = timeout < 0 ? 0 : timeout;

	var that = this;

	this.timer = setTimeout(function () {
		that.timer = null;

		that.next = next;
		that.emit('run', new Date(next));
		if (that.locked) {
			that.locked = false;
		} else {
			that.spool();
		}
	}, timeout);
};


/**
 * Determine, set and return the next event.
 *
 * @param  {Date|Undefined} last
 * @param  {Function}       fn
 * @return {Date}
 */

Schedule.prototype.getNextEvent = function (last, fn) {
	if (this.isInvalid()) {
		return null;
	}

	if (last === undefined) {
		this.next = this.next || new Date(Date.now());
	} else {
		last = new Date(last);
		if (!isNaN(+last)) {
			this.next = last;
		}
	}

	if (!this.next) {
		return null;
	}

	if (this.start > this.next) {
		this.next.setTime(+this.start);
	}

	var next = fn.call(this, this.next);

	this.next = (new Date(this.end) < next || isNaN(+next)) ? null : next;

	return this.next;
};


/**
 * Is this schedule valid?
 *
 * @return {Boolean}
 */

Schedule.prototype.isInvalid = function () {
	return !!((this.start && isNaN(+this.start)) || (this.end && isNaN(+this.end)));
};


/**
 * We don't want properties associated with EventEmitter to get stringified.
 *
 * @return {Object}
 */

Schedule.prototype.toJSON = function () {
	var toReturn = {};
	var toSkip = ['domain', '_events', '_maxListeners'];

	var keys = Object.keys(this);

	for (var i = 0, len = keys.length; i < len; i++) {
		var key = keys[i];

		if (toSkip.indexOf(key) === -1) {
			toReturn[key] = this[key];
		}
	}

	return toReturn;
};

// Expose the constructor as the module.
module.exports = Schedule;

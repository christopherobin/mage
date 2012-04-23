"use strict";

var events = require('events');

var Schedule = function Schedule(start, end) {
	events.EventEmitter.prototype.constructor.apply(this, []);

	Object.defineProperty(this, 'locked', {enumerable: false, writable: true, value: false});
	Object.defineProperty(this, 'timer', {enumerable: false, writable: true, value: null});
	Object.defineProperty(this, 'next', {enumerable: false, writable: true});

	if (start !== undefined && start !== null) {
		Object.defineProperty(this, 'start', {enumerable: true, writable: false, value: new Date(start)});
	}
	if (end !== undefined && end !== null) {
		Object.defineProperty(this, 'end', {enumerable: true, writable: false, value: new Date(end)});
	}
};

Schedule.prototype = Object.create(events.EventEmitter.prototype);

Schedule.prototype.constructor = Schedule;

Schedule.prototype.run = function () {
	if (this.isInvalid()) {
		this.emit('error', "Invalid Schedule");
	}
	else if (this.timer === null) {
		this.locked = false;
		this.spool();
	}
};

Schedule.prototype.cancel = function () {
	this.locked = true;
	if (this.timer) {
		clearTimeout(this.timer);
		this.timer = null;
	}
	this.emit('cancel');
};

Schedule.prototype.spool = function () {
	var next = this.getNextEvent();
	if (next) {
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
		}, timeout, false);
	} else {
		this.emit('end');
	}
};

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
		console.log(Object.prototype.toString.call(this.next));
		this.next.setTime(+this.start);
	}

	var next = fn.call(this, this.next);

	this.next = (new Date(this.end) < next || isNaN(+next)) ? null : next;
	return this.next;
};

Schedule.prototype.isInvalid = function () {
	return !!((this.start && isNaN(+this.start)) || (this.end && isNaN(+this.end)));
};

module.exports = Schedule;

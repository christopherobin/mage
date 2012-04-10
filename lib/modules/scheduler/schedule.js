"use strict";

var events = require('events');

var Schedule = function (f) {
	events.EventEmitter.prototype.constructor.apply(this, []);
	Object.defineProperty(this, 'next', {enumerable: false, writable: true});
	Object.defineProperty(this, 'locked', {enumerable: false, writable: true, value: false});
	Object.defineProperty(this, 'timer', {enumerable: false, writable: true, value: null});
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
	var next = this.getNextEvent(this.next);
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
Schedule.prototype.getNextEvent = function (last) {
	return null;
};
Schedule.prototype.isInvalid = function () {
	return true;
};

module.exports = Schedule;

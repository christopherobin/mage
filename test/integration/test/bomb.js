var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var DEFAULT_DURATION = 90 * 1000;

function Bomb() {
	EventEmitter.call(this);
	this.start = Date.now();
}

inherits(Bomb, EventEmitter);

Bomb.prototype.explode = function (name) {
	name = name || this.name;

	this.emit('exploded', name);
};

Bomb.prototype.arm = function (name, duration) {
	clearTimeout(this.fuse);

	this.duration = duration || DEFAULT_DURATION;
	this.name = name;
	this.start = Date.now();

	var that = this;
	this.fuse = setTimeout(that.explode, this.duration);
};

Bomb.prototype.disarm = function (name) {
	if (this.name !== name) {
		return this.explode(name);
	}

	clearTimeout(this.fuse);

	this.emit('disarmed', name, Date.now() - this.start);
};

module.exports = Bomb;

var EventEmitter = require('emitter');
var inherits = require('inherit');

function EventManager() {
	EventEmitter.call(this);
}

inherits(EventManager, EventEmitter);

EventManager.prototype.emitEvent = function (fullPath, params) {
	// accepts only a single params object (which may be of any type)

	var path = fullPath.split('.');

	while (path.length) {
		this.emit.apply(this, [path.join('.'), fullPath, params]);
		path.pop();
	}
};


EventManager.prototype.emitEvents = function (events) {
	for (var i = 0; i < events.length; i += 1) {
		var evt = events[i];

		if (evt) {
			this.emitEvent(evt[0], evt[1]); // magic array positions: path, params
		}
	}
};

module.exports = EventManager;

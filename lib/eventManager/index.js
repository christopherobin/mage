var EventEmitter = require('emitter');
var inherits = require('inherit');

function EventManager() {
	EventEmitter.call(this);
	this._blocked = {};
}

inherits(EventManager, EventEmitter);


function parsePath(path) {
	if (Array.isArray(path)) {
		if (path.length === 0) {
			throw new Error('An empty path is not a valid event path');
		}

		return path.slice();
	}

	if (typeof path === 'string') {
		if (path.length === 0) {
			throw new Error('An empty path is not a valid event path');
		}

		return path.split('.');
	}

	throw new TypeError('An event path must be a non-empty array or a string');
}


function createPathFamily(path) {
	// longest paths first

	var family = [];

	path = parsePath(path);

	while (path.length > 0) {
		family.push(path.join('.'));
		path.pop();
	}

	return family;
}


EventManager.prototype.emitEvent = function (fullPath, params) {
	// accepts only a single params object (which may be of any type)

	if (this.isBlocked(fullPath)) {
		return;
	}

	var paths = createPathFamily(fullPath);

	for (var i = 0; i < paths.length; i += 1) {
		this.emit(paths[i], fullPath, params);
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


function pathToRegExpStr(path) {
	var steps = parsePath(path);

	var chunks = [];

	for (var i = 0; i < steps.length; i += 1) {
		var step = steps[i];

		if (step === '**') {
			chunks.push('.+?');
		} else if (step === '*') {
			chunks.push('[^\\.]+');
		} else {
			chunks.push(step);
		}
	}

	return '^' + chunks.join('\\.') + '$';
}


EventManager.prototype.isBlocked = function (path) {
	if (typeof path !== 'string' || path.length === 0) {
		throw new TypeError('Event path must be a non-empty string');
	}

	var keys = Object.keys(this._blocked);
	for (var i = 0; i < keys.length; i += 1) {
		var re = this._blocked[keys[i]];

		if (re.test(path)) {
			return true;
		}
	}

	return false;
};


EventManager.prototype.block = function (path) {
	var re = pathToRegExpStr(path);

	this._blocked[re] = new RegExp(re);
};


EventManager.prototype.unblock = function (path) {
	var re = pathToRegExpStr(path);

	delete this._blocked[re];
};

module.exports = EventManager;

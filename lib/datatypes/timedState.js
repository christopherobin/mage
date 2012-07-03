// to initialize a timed value, either "setRaw" or "reset" _must_ be called before using any other functions.
// if EventEmitter exists, it will be used as a prototype

var EventEmitter = require('events').EventEmitter;


/* states object:
 *
 * {
 *   stateName: [interval, changeToStateName],
 *   stateName: [interval, changeToStateName],
 *   stateName: null
 * }
 */

function TimedState(baseCfg) {
	this.baseCfg = baseCfg;
}


module.exports = TimedState;


TimedState.prototype = new EventEmitter();


TimedState.getCurrentTimestamp = function () {
	return (Date.now() / 1000) >>> 0;
};


TimedState.prototype.getRaw = function () {
	return this.cfg;
};


TimedState.prototype.toJSON = TimedState.prototype.getRaw;


TimedState.prototype.setRaw = function (cfg) {
	// eg: { stored: { state: 'stateName', time: 123216732 }, states: { stateconfiguration } }

	if (cfg) {
		this.reset(cfg.stored, cfg.states);
	}
};


TimedState.prototype._createCfg = function () {
	this.cfg = {};

	if (this.baseCfg) {
		for (var key in this.baseCfg) {
			this.cfg[key] = this.baseCfg[key];
		}
	}
};


TimedState.prototype.reset = function (stored, states) {
	this._createCfg();
	this.registerStates(states);
	this.setState(stored.state, stored.time, stored.interval);
};


TimedState.prototype.registerStates = function (states) {
	if (!this.cfg) {
		this._createCfg();
	}

	this.cfg.states = states;
	this.cfg.stored = { state: null, time: null };
};


TimedState.prototype.setState = function (state, saveTime, altInterval) {
	// requires the cfg to be initialized

	var stored = {
		state: state,
		time: saveTime || TimedState.getCurrentTimestamp()
	};

	if (typeof altInterval === 'number') {
		stored.interval = altInterval;
	}

	this.getCfg().stored = stored;
};


TimedState.prototype.getCfg = function () {
	if (!this.cfg) {
		throw 'Config missing';
	}

	return this.cfg;
};


TimedState.prototype.getCurrentState = function () {
	var cfg = this.getCfg();
	var current = { state: cfg.stored.state, time: cfg.stored.time, interval: cfg.stored.interval };
	var now = TimedState.getCurrentTimestamp();
	var rule, interval, nextStateTime;

	do {
		rule = cfg.states[current.state];
		if (!rule) {
			// there is no change rule for this state (or state does not exist!)

			return current.state;
		}

		// calculate time required to move to the next state

		interval = (typeof current.interval === 'number') ? current.interval : rule[0];

		nextStateTime = current.time + interval;

		if (nextStateTime <= now) {
			if (current.state === rule[1]) {
				// circular state! endless loop detected
				return null;
			}

			current.state = rule[1];
			current.time = nextStateTime;
			current.interval = undefined;
		}
	} while (nextStateTime <= now);

	return current.state;
};


TimedState.prototype.getNextChange = function () {
	// return { time: nextChangeTime, from: currentState, to: nextState };

	var cfg = this.getCfg();
	var next = { state: cfg.stored.state, time: cfg.stored.time, interval: cfg.stored.interval };
	var currentState = cfg.stored.state;
	var now = TimedState.getCurrentTimestamp();
	var rule, interval;

	do {
		rule = cfg.states[next.state];
		if (!rule) {
			// there is no change rule for this state (or state does not exist!)

			return null;
		}

		// move to the next state

		if (next.state === rule[1]) {
			// circular state! endless loop detected
			return null;
		}

		interval = (typeof next.interval === 'number') ? next.interval : rule[0];

		if (next.time + interval > now) {
			currentState = next.state;
		}

		next.time += rule[0];
		next.state = rule[1];
		next.interval = undefined;
	} while (next.time <= now);

	return { time: next.time, from: currentState, to: next.state };
};


TimedState.prototype.getNextChangeTime = function () {
	var cfg = this.getCfg();
	var next = { state: cfg.stored.state, time: cfg.stored.time, interval: cfg.stored.interval };
	var now = TimedState.getCurrentTimestamp();
	var rule, interval;

	do {
		rule = cfg.states[next.state];
		if (!rule) {
			// there is no change rule for this state (or state does not exist!)

			return null;
		}

		// move to the next state

		if (next.state === rule[1]) {
			// circular state! endless loop detected
			return null;
		}

		interval = (typeof next.interval === 'number') ? next.interval : rule[0];

		next.time += interval;
		next.state = rule[1];
		next.interval = undefined;
	} while (next.time <= now);

	return next.time;
};


TimedState.prototype.getFinalChangeTime = function () {
	// this time may be in the past if we're already on the final state

	var cfg = this.getCfg();
	var current = { state: cfg.stored.state, time: cfg.stored.time, interval: cfg.stored.interval };
	var rule, interval;

	for (;;) {
		rule = cfg.states[current.state];
		if (!rule) {
			// there is no change rule for this state (or state does not exist!)

			return current.time;
		}

		// move to the next state

		if (current.state === rule[1]) {
			// circular state! endless loop detected
			return null;
		}

		interval = (typeof current.interval === 'number') ? current.interval : rule[0];

		current.time += interval;
		current.state = rule[1];
		current.interval = undefined;
	}
};


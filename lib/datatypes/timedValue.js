// to initialize a timed value, either "setRaw" or "reset" _must_ be called before using any other functions.
// if EventEmitter exists, it will be used as a prototype

var EventEmitter = require('events').EventEmitter;


function TimedValue(baseCfg) {
	this.baseCfg = baseCfg;
}


module.exports = TimedValue;


TimedValue.prototype = new EventEmitter();


TimedValue.prototype.setupEvents = function () {
	this.changeEvents = {
		lastEmittedValue: null,
		timer: null
	};

	this.emitChange();
};


TimedValue.prototype.emitChange = function () {
	this.emit('change', this.getCurrentValue());

	var currentTimer = this.changeEvents.timer;
	if (currentTimer) {
		clearTimeout(currentTimer);
		this.changeEvents.timer = null;
	}

	var nextChange = this.getNextChange();
	if (nextChange && nextChange.to) {
		var that = this;

		this.changeEvents.timer = setTimeout(
			function () {
				that.emitChange();
			},
			1000 * nextChange.time - Date.now()
		);
	}
};


TimedValue.getCurrentTimestamp = function () {
	return (Date.now() / 1000) >>> 0;
};


TimedValue.prototype.setup = function (iter) {
	this.iter = iter;
	this.cfg = null;

	if (this.setupEvents) {
		var that = this;
		var emitEvents = false;

		this.once('newListener', function () {
			if (emitEvents) {
				return;
			}

			that.setupEvents();

			emitEvents = true;
		});
	}

	if (this.cfg && this.cfg.meta) {
		iter.setMeta(this.cfg.meta);
	}
};


TimedValue.prototype.getRaw = function () {
	return this.cfg;
};


TimedValue.prototype.toJSON = TimedValue.prototype.getRaw;


TimedValue.prototype.setRaw = function (cfg) {
	// eg: { stored: { value: 10, time: 123216732 }, update: { timeOffset: 123217832, interval: 300 }, meta: { increment: 1, range: [0, 20] } }
	// the purpose of meta is to inform TimedValue subtypes, and may therefore contain anything the subtype needs, and may also be left out completely.

	if (cfg) {
		this.reset(cfg.stored, cfg.update, cfg.meta);
	}
};


TimedValue.prototype.reset = function (stored, updateRule, meta) {
	this.cfg = {};

	if (this.baseCfg) {
		for (var key in this.baseCfg) {
			this.cfg[key] = this.baseCfg[key];
		}
	}

	this.setUpdateRule(updateRule);

	if (meta) {
		this.setMeta(meta);
	}

	this.setValue(stored.value, stored.time);
};


TimedValue.prototype.setValue = function (value, saveTime) {
	// requires the cfg to be initialized

	this.getCfg().stored = {
		value: value,
		time: saveTime || TimedValue.getCurrentTimestamp()
	};

	if (this.emit) {
		this.emit('change', this.getCurrentValue());
	}
};


TimedValue.prototype.setUpdateRule = function (updateRule) {
	// requires the cfg to be initialized
	// the timeOffset is optional, and when left out (null, undefined), the savedTime will be used to anchor the calculation to.

	// updateRule: { interval, timeOffset (optional) }

	this.getCfg().update = updateRule;
};


TimedValue.prototype.setMeta = function (meta) {
	// requires the cfg to be initialized

	this.getCfg().meta = meta;

	if (this.iter) {
		this.iter.setMeta(meta);
	}
};


TimedValue.prototype.getCfg = function () {
	if (!this.cfg) {
		throw 'Config missing';
	}

	return this.cfg;
};


TimedValue.prototype.getCurrentValue = function () {
	var cfg = this.getCfg();
	var now = TimedValue.getCurrentTimestamp();
	var offset = (cfg.update && (cfg.update.timeOffset || cfg.update.timeOffset === 0)) ? cfg.update.timeOffset : cfg.stored.time;
	var stepsPassedUntilStored = Math.floor((cfg.stored.time - offset) / cfg.update.interval);
	var stepsPassedUntilNow = Math.floor((now - offset) / cfg.update.interval);
	var stepsToExecute = stepsPassedUntilNow - stepsPassedUntilStored;
	var value = cfg.stored.value;

	for (var i = 0; i < stepsToExecute; i++) {
		value = this.iter.getNextValue(value);

		if (this.iter.isLastValue(value)) {
			break;
		}
	}

	return value;
};


TimedValue.prototype.getNextChange = function () {
	var cfg = this.getCfg();
	var now = TimedValue.getCurrentTimestamp();
	var offset = (cfg.update && (cfg.update.timeOffset || cfg.update.timeOffset === 0)) ? cfg.update.timeOffset : cfg.stored.time;
	var stepsPassedUntilStored = Math.floor((cfg.stored.time - offset) / cfg.update.interval);
	var stepsPassedUntilNow = Math.floor((now - offset) / cfg.update.interval);
	var stepsToExecute = stepsPassedUntilNow - stepsPassedUntilStored;
	var currentValue = cfg.stored.value;
	var nextValue = this.iter.isLastValue(currentValue) ? undefined : this.iter.getNextValue(currentValue);

	for (var i = 0; i < stepsToExecute; i++) {
		currentValue = nextValue;
		nextValue = this.iter.getNextValue(nextValue);

		if (this.iter.isLastValue(currentValue)) {
			nextValue = undefined;
			break;
		}
	}

	var nextChangeTime = offset + (stepsPassedUntilNow + 1) * cfg.update.interval;

	var response = { time: nextChangeTime, from: currentValue };

	if (nextValue !== undefined) {
		response.to = nextValue;
	}

	return response;
};


TimedValue.prototype.getNextChangeTime = function () {
	var cfg = this.getCfg();
	var now = TimedValue.getCurrentTimestamp();
	var offset = (cfg.update && (cfg.update.timeOffset || cfg.update.timeOffset === 0)) ? cfg.update.timeOffset : cfg.stored.time;
	var stepsPassedUntilNow = Math.floor((now - offset) / cfg.update.interval);

	return offset + (stepsPassedUntilNow + 1) * cfg.update.interval;
};


TimedValue.prototype.getFinalChangeTime = function () {
	var cfg = this.getCfg();

	// check the last stored time, since it may have been the final change

	if (this.iter.isLastValue(cfg.stored.value)) {
		return cfg.stored.time;
	}

	// look for the last change

	var offset = (cfg.update && (cfg.update.timeOffset || cfg.update.timeOffset === 0)) ? cfg.update.timeOffset : cfg.stored.time;
	var stepsPassedUntilStored = Math.floor((cfg.stored.time - offset) / cfg.update.interval);
	var value = this.iter.getNextValue(cfg.stored.value);
	var time = offset + (stepsPassedUntilStored + 1) * cfg.update.interval;

	while (!this.iter.isLastValue(value)) {
		time += cfg.update.interval;

		value = this.iter.getNextValue(value);
	}

	return time;
};


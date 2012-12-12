var mithril = require('./mithril');
var Panopticon = require('./Panopticon');
var processManager = require('./processManager');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

// panoptica is an array with each element a panopticon. Multiple may be needed for different
// sample intervals.
var panoptica = [];

/**
 * If we want to send something to all instances of panoptica, it goes through here.
 *
 * @param {String} method A method of an individual panopticon.
 * @return {Function} The returned function is a wrapper around method of all panoptica.
 */
function createSamplerMethod(method) {
	return function (n) {
		for (var i = 0, len = panoptica.length; i < len; i++) {
			panoptica[i][method](n);
		}
	};
}

// Exported functions are just forwarding to methods of panoptica of the same name.
exports.inc         = createSamplerMethod('inc');
exports.set         = createSamplerMethod('set');
exports.sample      = createSamplerMethod('sample');
exports.timedSample = createSamplerMethod('timedSample');

var gatheredData = {};

/**
 * Register events with an instance of panopticon.
 *
 * @param {Object} panopticon
 */
function setupEventCounters(panopticon) {
	var state = require('./state');
	var mysql = require('./datasources/mysql');
	var datasources = require('./datasources');
	var commandCenter = require('./commandCenter');

	processManager.on('workerOffline', function () {
		panopticon.inc(null, 'workerOffLine', 1);
	});

	state.on('error', function () {
		panopticon.inc(['state'], 'errors', 1);
	});

	state.on('created', function () {
		panopticon.inc(['state'], 'created', 1);
	});

	state.on('destroyed', function () {
		panopticon.inc(['state'], 'destroyed', 1);
	});

	state.on('timeOut', function () {
		panopticon.inc(['state'], 'timeOut', 1);
	});

	mysql.on('error', function (errorCode, errorNum) {
		panopticon.inc(['datasources', 'mysql'], errorCode + ':' + errorNum, 1);
	});

	mysql.on('mysqlQuery', function () {
		panopticon.inc(['datasources', 'mysql'], 'queries', 1);
	});

	mysql.on('mysqlQueryDuration', function (duration) {
		panopticon.timedSample(['datasources', 'mysql'], 'duration', duration);
	});

	datasources.on('datasourceConnect', function () {
		panopticon.inc(['datasources'], 'connects', 1);
	});

	datasources.on('datasourceDisconnect', function () {
		panopticon.inc(['datasources'], 'disconnects', 1);
	});

	commandCenter.on('openPostConnection', function (app) {
		panopticon.inc([app.name, 'postConnections'], 'opened', 1);
	});

	commandCenter.on('closePostConnection', function (app) {
		panopticon.inc([app.name, 'postConnections'], 'closed', 1);
	});

	commandCenter.on('completed', function (app, cmd, duration) {
		panopticon.timedSample([app.name, 'userCommands'], cmd.name, duration);
	});
}

/**
 * Each interval we may want to set some data. A panopticon instance needs to tell us when we can
 * do this. This function registers the listener.
 *
 * @param {Object} panopticon
 */
function perIntervalSets(panopticon) {
	panopticon.on('newInterval', function () {
		panopticon.set(null, 'pid', process.pid);
	});
}


/**
 * Query the current aggregate using a path array.
 *
 * @param {String[]} path An array of keys used to address an arbitrary position in an object.
 * @param {Function} cb cb(error, data), error is truthy if a path did not resolve. data is the object or otherwise addressed by path when successful.
 */
exports.query = function (path, cb) {
	var response = gatheredData;

	for (var i = 0, len = path.length; i < len; i++) {
		var subPath = path[i];

		// Return early and respond with 404 if this path doesn't resolve.
		if (!response.hasOwnProperty(subPath)) {
			return cb(new Error('noMatchingPath'));
		}

		// The sub path resolved. Move the reference along and continue.
		response = response[subPath];
	}

	return cb(null, response);
};


// This sets up the sampler and starts panopticon underneath. Whether we are sampling mithril and
// the sampling interval are obtained from config.
exports.setup = function () {
	// We need some initialisation data from config.
	var init = mithril.core.config.get('server.sampler');

	// Panopticon reports in milliseconds by default. We want seconds, so we pass in this scale
	// factor.
	var scaleFactor = 1000;

	// If no intervals are given, skip the rest.
	if (!init || !init.intervals || init.intervals.length === 0) {
		return;
	}

	// If the intervals given was not an array, then error and return from this function early.
	if (!Array.isArray(init.intervals)) {
		if (!processManager.isWorker) {
			mithril.core.logger.error('intervals must be an array of numbers.');
		}

		return;
	}

	// Assemble a list of intervals, removing repeated elements.
	var intervals = init.intervals.reduce(function (stack, element) {
		return stack.indexOf(element) === -1 ? stack.concat(element) : stack;
	}, []);

	// If there was one or more repeated elements, warn and continue.
	if (!processManager.isWorker && intervals.length !== init.intervals.length) {
		mithril.core.logger.warning('intervals had repeated elements.');
	}

	// Create a list of new panoptica to accept samples.
	panoptica = intervals.map(function (interval) {
		return new Panopticon(processManager.startTime, interval, scaleFactor, true, true);
	});

	// In the case of truthy sampleMithril, we want to use the default loggers and setters.
	if (init && init.sampleMithril) {
		panoptica.forEach(function (panopticon) {
			setupEventCounters(panopticon);
			perIntervalSets(panopticon);
		});
	}

	// This emission should fire once for the master only. This must be listened for in game code
	// *before* mithril.setup has been called.
	exports.emit('setup', !mithril.core.processManager.isWorker);

	// Forward data from panopticon to the game. The game will look at the interval to determine
	// which panopticon is which.
	panoptica.forEach(function (panopticon) {
		panopticon.on('delivery', function (data) {
			gatheredData[data.interval] = data;
		});
	});

	mithril.once('shutdown', function () {
		panoptica.forEach(function (panopticon) {
			panopticon.stop();
		});
	});
};

var mithril = require('./mithril');
var Panopticon = require('./panopticon');
var processManager = require('./processManager');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

exports.sample = function () {};
exports.set = function () {};
exports.inc = function () {};

/**
 * Register events with an instance of panopticon.
 *
 * @param panopticon
 */
function setupEventCounters(panopticon) {
	var state = require('./state');
	var mysql = require('./datasources/mysql');
	var datasources = require('./datasources');
	var commandCenter = require('./commandCenter');


	// Assemble a hash of mysql error codes to error names.
	var sqlLibClient = require('mysql').Client;
	var sqlErrorCodes = {};

	for (var key in sqlLibClient) {
		if  (sqlLibClient.hasOwnProperty(key) && key.split('_')[0] === 'ERROR') {
			sqlErrorCodes[sqlLibClient[key]] = key;
		}
	}

	processManager.on('workerOffline', function () {
		panopticon.inc(null, 'workerOffLine', 1);
	});

	// Count errors handled by a state object.
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

	// Uses a hash to look up error codes. If no code is given, log it as MISC_ERROR.
	mysql.on('error', function (error) {
		if (!error.hasOwnProperty('number')) {
			panopticon.inc(['datasources', 'mysql'], 'MISC_ERROR', 1);
			return;
		}

		panopticon.inc(['datasources', 'mysql'], sqlErrorCodes[error.number], 1);
	});

	mysql.on('mysqlQuery', function () {
		panopticon.inc(['datasources', 'mysql'], 'queries', 1);
	});

	mysql.on('mysqlQueryDuration', function (duration) {
		panopticon.sample(['datasources', 'mysql'], 'duration', duration);
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
		panopticon.sample([app.name, 'userCommands'], cmd.name, duration);
	});
}



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
	var panoptica = intervals.map(function (interval) {
		return new Panopticon(processManager.startTime, interval, scaleFactor);
	});

	var length = panoptica.length;

	// sample, set and inc send data to all instances of panopticon.
	exports.sample = function (n) {
		for (var i = 0; i < length; i += 1) {
			panoptica[i].sample(n);
		}
	};

	exports.set = function (n) {
		for (var i = 0; i < length; i += 1) {
			panoptica[i].set(n);
		}
	};

	exports.inc = function (n) {
		for (var i = 0; i < length; i += 1) {
			panoptica[i].inc(n);
		}
	};

	// In the case of truthy sampleMithril, we want to use the default loggers.
	if (init && init.sampleMithril) {
		panoptica.forEach(function (panopticon) {
			setupEventCounters(panopticon);
		});
	}

	// This emission should fire once for the master only. This must be listened for in game code
	// *before* mithril.setup has been called.
	exports.emit('setup', !mithril.core.processManager.isWorker);

	// Forward data from panopticon to the game. The game will look at the interval to determine
	// which panopticon is which.
	panoptica.forEach(function (panopticon) {
		panopticon.on('delivery', function (data) {
			exports.emit('delivery', data);
		});
	});

	mithril.once('shutdown', function () {
		panoptica.forEach(function (panopticon) {
			panopticon.stop();
		});
	});
};

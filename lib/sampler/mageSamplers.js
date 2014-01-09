var processManager;
var state;
var commandCenter;
var archivist;
var msgServer;

var memwatch = require('memwatch');


/**
 * Pass in references to the emitters that mageSamplers needs access to.
 *
 * @param {Object} procMan       The process manager library.
 * @param {Object} stateObj      The state library.
 * @param {Object} cmdCenter     The command center library.
 * @param {Object} archivistObj  The archivist core library.
 * @param {Object} msgServerObj  The message server library.
 */

exports.initialize = function (procMan, stateObj, cmdCenter, archivistObj, msgServerObj) {
	processManager = procMan;
	state = stateObj;
	commandCenter = cmdCenter;
	archivist = archivistObj;
	msgServer = msgServerObj;
};


/**
 * Add mage core library loggers to a panopticon instance.
 *
 * @param {Panopticon} panopticon A Panopticon instance.
 */

exports.setupEventCounters = function (panopticon) {
	processManager.on('workerOffline', function () {
		panopticon.inc(null, 'workerOffLine', 1);
	});

	state.on('stateError', function () {
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

	archivist.on('vaultError', function (vaultName, typeOrOperation) {
		// these are errors at the vault-level (connections gone bad, DB gone, etc)

		panopticon.inc(['archivist', vaultName, 'errors'], typeOrOperation, 1);
	});

	archivist.on('operation', function (vaultName, operation, duration) {
		panopticon.timedSample(['archivist', vaultName, 'operations'], operation, duration);
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

	memwatch.on('stats', function (stats) {
		/* jshint camelcase:false */

		// for information on the value of the numbers in stats, see
		// https://github.com/lloyd/node-memwatch/blob/master/src/memwatch.cc#L36

		panopticon.set(['memory', 'v8heap'], 'num_full_gc', stats.num_full_gc);
		panopticon.set(['memory', 'v8heap'], 'num_inc_gc', stats.num_inc_gc);
		panopticon.set(['memory', 'v8heap'], 'num_compactions', stats.heap_compactions);
		panopticon.set(['memory', 'v8heap'], 'current_base', stats.current_base);
		panopticon.set(['memory', 'v8heap'], 'estimated_base', stats.estimated_base);
		panopticon.set(['memory', 'v8heap'], 'usage_trend', stats.usage_trend);
		panopticon.set(['memory', 'v8heap'], 'min', stats.min);
		panopticon.set(['memory', 'v8heap'], 'max', stats.max);
	});

	msgServer.comm.on('sendMessage', function (msg) {
		panopticon.inc(['msgServer'], 'bytesSent', msg.length);
		panopticon.inc(['msgServer'], 'messagesSent', 1);
	});
};


/**
 * Each interval we may want to set some data. A panopticon instance needs to tell us when we can
 * do this. This function registers the listener.
 *
 * @param {Panopticon} A Panopticon instance.
 */

exports.perIntervalSets = function (panopticon) {
	panopticon.on('newInterval', function () {
		panopticon.set(null, 'pid', process.pid);

		var numWorkers = processManager.getNumWorkers();

		if (typeof numWorkers === 'number') {
			panopticon.set(null, 'numWorkers', numWorkers);
		}
	});
};

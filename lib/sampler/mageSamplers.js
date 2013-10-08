var processManager;
var state;
var commandCenter;
var archivist;


/**
 * Pass in references to the emitters that mageSamplers needs access to.
 *
 * @param {Object} procMan       The process manager library.
 * @param {Object} stateObj      The state library.
 * @param {Object} cmdCenter     The command center library.
 * @param {Object} archivistObj  The archivist core library.
 */

exports.initialize = function (procMan, stateObj, cmdCenter, archivistObj) {
	processManager = procMan;
	state = stateObj;
	commandCenter = cmdCenter;
	archivist = archivistObj;
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

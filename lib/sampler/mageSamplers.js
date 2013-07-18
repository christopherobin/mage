var processManager;
var state;
var mysql;
var datasources;
var commandCenter;


/**
 * Pass in references to the emitters that mageSamplers needs access to.
 *
 * @param {Object} procMan        The process manager library.
 * @param {Object} stateObj       The state library.
 * @param {Object} mysqlObj       The MySQL library.
 * @param {Object} datasourcesObj The data sources library.
 * @param {Object} cmdCenter      The command center library.
 */

exports.initialize = function (procMan, stateObj, mysqlObj, datasourcesObj, cmdCenter) {
	processManager = procMan;
	state = stateObj;
	mysql = mysqlObj;
	datasources = datasourcesObj;
	commandCenter = cmdCenter;
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

	mysql.on('mysqlError', function (errorCode, errorNum) {
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

		if (!processManager.isWorker) {
			panopticon.set(null, 'numWorkers', processManager.getNumWorkers());
		}
	});
};

var mithril = require('./mithril');
var Panopticon = require('./panopticon');
var processManager = require('./processManager');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var panopticon;

exports.sample = function () {};
exports.set = function () {};
exports.inc = function () {};


function setupEventCounters() {
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

	// Create a new panopticon object to accept samples.
	panopticon = new Panopticon(processManager.startTime, init.interval);

	exports.sample = panopticon.sample;
	exports.set = panopticon.set;
	exports.inc = panopticon.inc;

	// In the case of truthy logMithril, we need to require libraries to observe their emissions.
	if (init && init.sampleMithril) {
		setupEventCounters();
	}

	// This emission should fire once for the master only. This must be listened for in game code
	// *before* mithril.setup has been called.
	exports.emit('setup', !mithril.core.processManager.isWorker);

	// Forward data from panopticon to the game.
	panopticon.on('delivery', function (data) {
		exports.emit('delivery', data);
	});

	mithril.once('shutdown', function () {
		panopticon.stop();
	});
};

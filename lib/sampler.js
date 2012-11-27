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


	// Fires on state creation. Increment stateCount.
	state.on('stateCreated', function () {
		panopticon.inc('stateCount', 1);
	});


	// Fires on state destruction. Decrement stateCount.
	state.on('stateDestroyed', function () {
		panopticon.inc('stateCount', -1);
	});


	// Fires on an MySQL read timeout. Increments sqlReadTimeOut.
	state.on('sqlReadTimeOut', function () {
		panopticon.inc('sqlReadTimeOut', 1);
	});


	// Fires on an MySQL write timeout. Increments sqlWriteTimeOut.
	state.on('sqlWriteTimeOut', function () {
		panopticon.inc('sqlWriteTimeOut', 1);
	});


	// Fires on an MySQL lock wait timeout. Increments sqlLockWaitTimeOut.
	state.on('sqlLockWaitTimeOut', function () {
		panopticon.inc('sqlLockWaitTimeOut', 1);
	});


	// If the MySQL error isn't one that we're specifically looking for, we log this.
	state.on('sqlMiscError', function () {
		panopticon.inc('sqlReadTimeOut', 1);
	});


	// Fires on the creation of a mysqlQuery
	mysql.on('mysqlQuery', function () {
		panopticon.inc('sqlQueryCount', 1);
	});


	mysql.on('mysqlQueryDuration', function (duration) {
		panopticon.sample('mysqlQueryDuration', duration);
	});


	datasources.on('datasourceConnect', function () {
		panopticon.inc('datasourceConnect', 1);
	});


	datasources.on('datasourceDisconnect', function () {
		panopticon.inc('datasourceConnect', -1);
	});


	commandCenter.on('openPostConnection', function () {
		panopticon.inc('openPostConnections', 1);
		panopticon.inc('totalPostConnections', 1);
	});


	commandCenter.on('closePostConnection', function () {
		panopticon.inc('openPostConnections', -1);
	});
}



// This sets up the sampler and starts panopticon underneath. Whether we are logging mithril and the
// logging interval are obtained from config.
exports.setup = function () {
	// We need some initialisation data from config.
	var init = mithril.core.config.get('server.sampler');

	// Create a new panopticon object to accept samples.
	panopticon = new Panopticon(processManager.startTime, init.interval);

	exports.sample = panopticon.sample;
	exports.set = panopticon.set;
	exports.inc = panopticon.inc;

	// In the case of truthy logMithril, we need to require libraries to observe their emissions.
	if (init && init.logMithril) {
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

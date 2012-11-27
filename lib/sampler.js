var mithril = require('./mithril');
var Panopticon = require('./panopticon');
var processManager = require('./processManager');
var EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();
var panopticon = null;


module.exports.setup = function () {
	var init = mithril.core.config.get('server.sampler');

	panopticon = new Panopticon(processManager.startTime, init.interval);

	// In the case of truthy logMithril, we need to require libraries to observe their emissions.
	if (init && init.logMithril) {
		var state = require('./state');
		var mysql = require('./datasources/mysql');
		var datasources = require('./datasources');
		var commandCenter = require('./commandCenter');


		// Fires on state creation. Increment stateCount.
		state.on('stateCreated', function () {
			module.exports.inc('stateCount', 1);
		});


		// Fires on state destruction. Decrement stateCount.
		state.on('stateDestroyed', function () {
			module.exports.inc('stateCount', -1);
		});


		// Fires on an MySQL read timeout. Increments sqlReadTimeOut.
		state.on('sqlReadTimeOut', function () {
			module.exports.inc('sqlReadTimeOut', 1);
		});


		// Fires on an MySQL write timeout. Increments sqlWriteTimeOut.
		state.on('sqlWriteTimeOut', function () {
			module.exports.inc('sqlWriteTimeOut', 1);
		});


		// Fires on an MySQL lock wait timeout. Increments sqlLockWaitTimeOut.
		state.on('sqlLockWaitTimeOut', function () {
			module.exports.inc('sqlLockWaitTimeOut', 1);
		});


		// If the MySQL error isn't one that we're specifically looking for, we log this.
		state.on('sqlMiscError', function () {
			module.exports.inc('sqlReadTimeOut', 1);
		});


		// Fires on the creation of a mysqlQuery
		mysql.on('mysqlQuery', function () {
			module.exports.inc('sqlQueryCount', 1);
		});


		mysql.on('mysqlQueryDuration', function (duration) {
			module.exports.sample('mysqlQueryDuration', duration);
		});


		datasources.on('datasourceConnect', function () {
			module.exports.inc('datasourceConnect', 1);
		});


		datasources.on('datasourceDisconnect', function () {
			module.exports.inc('datasourceConnect', -1);
		});


		commandCenter.on('openPostConnection', function () {
			module.exports.inc('openPostConnections', 1);
			module.exports.inc('totalPostConnections', 1);
		});


		commandCenter.on('closePostConnection', function () {
			module.exports.inc('openPostConnections', -1);
		});
	}

	// This emission should fire once for the master only. This must be listened for in game code *before*
	// mithril.setup has been called.
	module.exports.emit('setup', mithril.core.processManager.isMaster);

	// Forward data from panopticon to the game.
	panopticon.on('delivery', function (data) {
		module.exports.emit('delivery', data);
	});

	mithril.on('quit', function () {
		panopticon.stop();
	});
};

// Are we logging mithril? This library bundles some functions for this, so the game engineer just needs to give us
// a true or false via mithril.samplerInit. How do I make this optional.


/**
 * Samples are data that you want a max, min, and potentially a standard deviation for.
 *
 * @param {string} name
 * @param {number} sample
 */
module.exports.sample = function (name, sample) {
	panopticon.sample(name, sample);
};


/**
 * Add sets using this function.
 *
 * @param {string} name
 * @param {number} setTo
 */
module.exports.set = function (name, setTo) {
	panopticon.set(name, setTo);
};


/**
 * Sample definitions are cached by this library. Add increments using this function.
 *
 * @param {string} name
 * @param {number} by Usually 1 (increment) or -1 (decrement)
 */
module.exports.inc = function (name, by) {
	panopticon.inc(name, by);
};
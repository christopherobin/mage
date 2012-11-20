var mithril = require('../../mithril');
var panopticon = require('./panopticon');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

exports.setup = function (nothing, callback) {
	var init = mithril.core.config.get('server.sampler');
	panopticon.setup(Date.now() / 1000, init.interval);

	if (!init || !init.logMithril) {
		return callback();
	}


	var state = require('./../../state');
	var mysql = require('./../../datasources/mysql');
	var datasources = require('./../../datasources');
	var commandCenter = require('./../../commandCenter');


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

	return callback();
};

// Are we logging mithril? This library bundles some functions for this, so the game engineer just needs to give us
// a true or false via mithril.samplerInit. How do I make this optional.


/**
 * Samples are data that you want a max, min, and potentially a standard deviation for.
 *
 * @param {string} name
 * @param {number} sample
 */
exports.sample = function (name, sample) {
	panopticon.sample(name, sample);
};


/**
 * Add sets using this function.
 *
 * @param {string} name
 * @param {number} setTo
 */
exports.set = function (name, setTo) {
	panopticon.set(name, setTo);
};


/**
 * Sample definitions are cached by this library. Add increments using this function.
 *
 * @param {string} name
 * @param {number} by Usually 1 (increment) or -1 (decrement)
 */
exports.inc = function (name, by) {
	panopticon.inc(name, by);
};


panopticon.on('delivery', function (data) {
	exports.emit('sample', data);
});
var mithril = require('./mithril');
var getStateCount = require('./state').getStateCount;
var getConnectionCount = require('./datasources').getConnectionCount;
var getAndResetQueryCount = require('./datasources/mysql').getAndResetQueryCount;
var panopticon = require('./panopticon');
var fs = require('fs');

var EventEmitter = require('events').EventEmitter;
var exports = module.exports = new EventEmitter();

var setCache = [];
var sampleCache = [];
var incCache = [];
var sampleInterval = 2500;
var interval = null;

var handler = function () {};


exports.sample = function (name, sampleFunc) {
	sampleCache.push({
		name: name,
		sample: sampleFunc
	});
};

// Sample definitions are cached by this library. Add sets using this function.
exports.set = function (name, sampleFunc) {
	setCache.push({
		name: name,
		sample: sampleFunc
	});
};

// Sample definitions are cached by this library. Add increments using this funtion.
exports.inc = function (name, increment) {
	incCache.push({
		name: name,
		increment: increment
	});
};

// Just need to clear the sample interval and tell panopticon to clean itself up.
mithril.on('shutdown', function () {
	panopticon.stop();
	clearInterval(sampleInterval);
});

function mithrilSamplers() {
	function getProcesPid() {
		return process.pid;
	}

	exports.sample('mysql.queries', getAndResetQueryCount);
	exports.set('process.pid', getProcesPid);
	exports.set('process.memory', process.memoryUsage);
	exports.set('states.open', getStateCount);
	exports.set('datasource.connections', getConnectionCount);
}


/**
 * mithril.sampleInit is defined by the game engineer, before mithril.setup is called. samplerInit looks like:
 *
 * mithril.samplerInit = {
 *     sampleFunc: function (sample) {...} <- What to do with the sample data.
 *     interval:  2500                     <- How often samples should be taken.
 *     logMithil: true                     <- Also log mithril.
 * }
 *
 * Sample functions can be added by the game developer using:
 *
 * mithril.core.sampler.set(name, function);
 *
 * where name is the key that the result will get in the sample object, and function acquires data and returns.
 */
exports.setup = function () {
	var samplerInit = mithril.samplerInit;

	// If no sample handler function or no interval (or both) have been defined. Skip the rest.
	//if (!samplerInit || typeof samplerInit.sampleFunc !== 'function' || typeof samplerInit.interval !== 'number') {
	if (!samplerInit || typeof samplerInit.interval !== 'number') {
		return;
	}

	// Are we logging mithril? This library bundles some functions for this, so the game engineer just needs to give us
	// a true or false via mithril.samplerInit.
	if (samplerInit.logMithril) {
		mithrilSamplers();
	}

	// We need this to determine if this is running on master or worker.
	var pm = mithril.core.processManager;

	// The master listens for samples from workers. Panopticon is only used on slaves.
	if (pm.isMaster) {
		var sampleData = { workers: {} };

		pm.on('message', function (message, workerId) { // From worker.
			if (message && message.event === 'sampleSet') {
				sampleData.workers[workerId] = message.data;
			}
		});

		pm.on('workerOffline', function (workerId) { // Remove worker data if it goes offline.
			delete sampleData.workers[workerId];
		});

		// We want to read sample data every interval and handle it with the function given by the game developer.
		sampleInterval = setInterval(function () {
			if (samplerInit.logMithril) { // Are we logging mithril? If so put mithril logging functions into the caches.
				sampleData.numWorkers = pm.numWorkers();
			}

			if (Object.keys(sampleData.workers).length !== 0) { // We only care if there is data to display.
				exports.emit('sample', sampleData);
			}
		}, samplerInit.interval);
		return;
	}

	// Slaves collect data and send samples to master for aggregation.

	// panopticon needs to know how often to take samples.
	panopticon.setup(samplerInit.interval);

	// Send the set and increment caches to panopticon so it knows what to log.
	panopticon.on('collect', function () {
		setCache.forEach(function (entry) {
			panopticon.set(entry.name, entry.sample());
		});
		sampleCache.forEach(function (entry) {
			panopticon.sample(entry.name, entry.sample());
		});
		incCache.forEach(function (entry) {
			panopticon.inc(entry.name, entry.increment);
		});
	});

	// panopticon has finished sampling, and wants to deliver data. We tell it to deliver the data to master.
	panopticon.on('sampleSet', function (data) {
		pm.send({ event: 'sampleSet', data: data });
	});

	panopticon.start();


};
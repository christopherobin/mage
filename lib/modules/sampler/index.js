var mithril = require('../../mithril');
var async = require('async');
var stateCount = require('../../state').getStateCount;
var panopticon = require('./panopticon');

var setCache = [];
var incCache = [];
var debugInterval = null;


exports.start = function (handler, mithrilLogging) { // Sample data is sent to the handler so that a game engineer can choose what to do with it.
	var pm = mithril.core.processManager;

	if (mithrilLogging) {
		logMithril();
	}

	// The master listens for samples from workers, and handles enquiries from observium.
	if (pm.isMaster) {
		var sampleData = {};

		pm.on('message', function (message, workerId) { // From worker.
			if (message && message.event === 'sampleSet') {
				sampleData[workerId] = message.data;
			}
		});

		pm.on('workerOffline', function (workerId) {
			delete sampleData[workerId];
		});

		console.log('master!')
		handler(sampleData);
/*
		if (!httpServer) {
			mithril.core.logger.info('No httpServer found!');
			return;
		}

		httpServer.addRoute('/sampler', function (request, path, params, cb) {
			return cb(200, JSON.stringify(sampleData, null, '  '), { 'Content-Type': 'application/json' });
		});
*/
		return;
	}

	// Slaves collect data and send samples to master for aggregation.

	panopticon.setup();

	panopticon.on('collect', function () {
		setCache.forEach(function (entry) {
			panopticon.set(entry.name, entry.sample());
		});
		incCache.forEach(function (entry) {
			panopticon.inc(entry.name, entry.increment);
		});
	});

	panopticon.on('sampleSet', function (data) {
		pm.send({ event: 'sampleSet', data: data }); //give this to master
	});

	panopticon.start(mithril.core.time, 2500);
};



var logMithril = function () {
	exports.set('process.pid', function () {
		return process.pid;
	});
	exports.set('process.memory', process.memoryUsage);
	//exports.set('states.open', stateCount);
};


exports.set = function (name, func) {
	setCache.push({
		name: name,
		sample: func
	})
};

exports.inc = function (name, increment) {
	incCache.push({
		name: name,
		increment: increment
	});
};

mithril.on('shutdown', function () {
	clearInterval(debugInterval);
});
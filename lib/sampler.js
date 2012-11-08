var mithril = require('./mithril');
var state = require('./state');
var mysql = require('./datasources/mysql');
var datasources = require('./datasources');
var commandCenter = require('./commandCenter');
var panopticon = require('./panopticon');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var stateCount = 0;
var sqlReadTimeOut = 0;
var sqlWriteTimeOut = 0;
var sqlLockWaitTimeOut = 0;
var sqlMiscError = 0;
var sqlQueryCount = 0;
var datasourceConnections = 0;
var openPostConnections = 0;
var totalPostConnections = 0;
var sqlQueryTime = null;
var sqlQueryTimesCollected = [];

state.on('stateCreated', function () {
	stateCount += 1;
});
state.on('stateDestroyed', function () {
	stateCount -= 1;
});
state.on('sqlReadTimeOut', function () {
	sqlReadTimeOut += 1;
});
state.on('sqlWriteTimeOut', function () {
	sqlWriteTimeOut += 1;
});
state.on('sqlLockWaitTimeOut', function () {
	sqlLockWaitTimeOut += 1;
});
state.on('sqlMiscError', function () {
	sqlReadTimeOut += 1;
});

mysql.on('mysqlQuery', function () {
	sqlQueryCount += 1;
});
mysql.on('mysqlQueryDuration', function (duration) {
	if (!sqlQueryTime) {
		sqlQueryTime = { total: duration, count: 1 };
	} else {
		sqlQueryTime.total += duration;
		sqlQueryTime.count += 1;
	}
});
mysql.on('mysqlQueryDuration', function (duration) {
	sqlQueryTimesCollected.push(duration);
});

datasources.on('datasourceConnect', function () {
	datasourceConnections += 1;
});
datasources.on('datasourceDisconnect', function () {
	datasourceConnections -= 1;
});

commandCenter.on('openPostConnection', function () {
	openPostConnections += 1;
	totalPostConnections += 1;
});
commandCenter.on('closePostConnection', function () {
	openPostConnections -= 1;
});

// Cached sampler functions go in these. Every iteration the contents are called and the results fed to panopticon.
var setCache = [];
var sampleCache = [];
var incCache = [];

// This will contain the setInterval. In this scope so that it can be cleared when mithril emits 'shutdown'.
var sampleInterval = null;


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
exports.inc = function (name, sampleFunc) {
	incCache.push({
		name: name,
		sample: sampleFunc
	});
};

function standardDeviation(someArray) {
	var len = someArray.length;

	var mean = someArray.reduce(function (sum, time) {
		return sum + time;
	}, 0) / len;

	var squareDiffs = someArray.map(function (time) {
		var diff = time - mean;
		return diff * diff;
	});

	var standardDev = Math.sqrt(squareDiffs.reduce(function (sum, squareDiff) {
		return sum + squareDiff;
	}, 0) / len);

	return standardDev;
}

// This bundles sampler functions for mithril internals. They are registered in batch if the game programmer requires them.
function mithrilSamplers() {
	function getProcesPid() {
		return process.pid;
	}

	exports.sample('mysql.queries', function () {
		var toReturn = sqlQueryCount;
		sqlQueryCount = 0;
		return toReturn;
	});
	exports.set('mysql.averageDuration', function () {
		var averageDuration = sqlQueryTime ? (sqlQueryTime.total / sqlQueryTime.count) : 0;
		sqlQueryTime = null;
		return averageDuration;
	});
	exports.set('mysql.standardDeviation', function () {
		var timeArray = sqlQueryTimesCollected;
		sqlQueryTimesCollected = [];
		return standardDeviation(timeArray);
	});
	exports.sample('open.post.connections', function () {
		return openPostConnections;
	});
	exports.inc('sqlError.readTimeOut', function () {
		return sqlReadTimeOut;
	});
	exports.inc('sqlError.writeTimeOut', function () {
		return sqlWriteTimeOut;
	});
	exports.inc('sqlError.lockWaitTimeOut', function () {
		return sqlLockWaitTimeOut;
	});
	exports.inc('sqlError.misc', function () {
		return sqlMiscError;
	});
	exports.set('total.post.connections', function () {
		return totalPostConnections;
	});
	exports.set('process.pid', getProcesPid);
	exports.set('process.memory', process.memoryUsage);
	exports.set('states.open', function () {
		return stateCount;
	});
	exports.set('datasource.connections', function () {
		return datasourceConnections;
	});
}


/**
 * mithril.sampleInit is defined by the game engineer, before mithril.setup is called. samplerInit looks like:
 *
 * mithril.samplerInit = {
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

	// If no sample interval has been defined. Skip the rest.
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
			panopticon.inc(entry.name, entry.sample());
		});
	});

	// panopticon has finished sampling, and wants to deliver data. We tell it to deliver the data to master.
	panopticon.on('sampleSet', function (data) {
		pm.send({ event: 'sampleSet', data: data });
	});

	panopticon.start();
};


// Just need to clear the sample interval and tell panopticon to clean itself up.
mithril.on('shutdown', function () {
	panopticon.stop();
	clearInterval(sampleInterval);
});
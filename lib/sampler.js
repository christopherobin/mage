var mithril = require('./mithril');
var state = require('./state');
var mysql = require('./datasources/mysql');
var datasources = require('./datasources');
var commandCenter = require('./commandCenter');
var panopticon = require('./panopticon');
var EventEmitter = require('events').EventEmitter;
var membase = require('./datasources/membase');

exports = module.exports = new EventEmitter();

// Are we logging mithril? This library bundles some functions for this, so the game engineer just needs to give us
// a true or false via mithril.samplerInit. How do I make this optional.

/**
 * Increment function for mithril logging.
 *
 * @param {string} name
 * @param {number} number
 */
function mInc(name, number) {
	if (mithril.samplerInit && mithril.samplerInit.logMithril) {
		panopticon.inc(name, number);
	}
}

/**
 * Set function for mithril logging.
 *
 * @param {string} name
 * @param {number} number
 */
function mSet(name, number) {
	if (mithril.samplerInit && mithril.samplerInit.logMithril) {
		panopticon.set(name, number);
	}
}

/**
 * Samples for mithril logging.
 *
 * @param {string} name
 * @param {number} sample
 */
function mSample(name, sample) {
	if (mithril.samplerInit && mithril.samplerInit.logMithril) {
		panopticon.sample(name, sample);
	}
}


// Fires on state creation. Increment stateCount.
state.on('stateCreated', function () {
	mInc('stateCount', 1);
});


// Fires on state destruction. Decrement stateCount.
state.on('stateDestroyed', function () {
	mInc('stateCount', -1);
});


// Fires on an MySQL read timeout. Increments sqlReadTimeOut.
state.on('sqlReadTimeOut', function () {
	mInc('sqlReadTimeOut', 1);
});


// Fires on an MySQL write timeout. Increments sqlWriteTimeOut.
state.on('sqlWriteTimeOut', function () {
	mInc('sqlWriteTimeOut', 1);
});


// Fires on an MySQL lock wait timeout. Increments sqlLockWaitTimeOut.
state.on('sqlLockWaitTimeOut', function () {
	mInc('sqlLockWaitTimeOut', 1);
});


// If the MySQL error isn't one that we're specifically looking for, we log this.
state.on('sqlMiscError', function () {
	mInc('sqlReadTimeOut', 1);
});


// Fires on the creation of a mysqlQuery
mysql.on('mysqlQuery', function () {
	mInc('sqlQueryCount', 1);
});


mysql.on('mysqlQueryDuration', function (duration) {
	mSample('mysqlQueryDuration', duration);
});


datasources.on('datasourceConnect', function () {
	mInc('datasourceConnect', 1);
});


datasources.on('datasourceDisconnect', function () {
	mInc('datasourceConnect', -1);
});


commandCenter.on('openPostConnection', function () {
	mInc('openPostConnections', 1);
	mInc('totalPostConnections', 1);
});


commandCenter.on('closePostConnection', function () {
	mInc('openPostConnections', -1);
});


membase.on('membaseTransactionConnect', function () {
	mInc('membaseTransactions', 1);
});


// This will contain the setInterval. In this scope so that it can be cleared when mithril emits 'shutdown'.
var sampleInterval = null;


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


	// We need this to determine if this is running on master or worker (if cluster is being used).
	var pm = mithril.core.processManager;


	// The master listens for samples from workers. Panopticon is only used on slaves.
	if (pm.isMaster) {
		var sampleData = null;

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
			if (sampleData) {
				exports.emit('sample', sampleData);
			}

			if (!sampleData) {
				sampleData = { workers: {} };
			}

			if (samplerInit.logMithril) { // Are we logging mithril? If so put mithril logging functions into the caches.
				sampleData.numWorkers = pm.numWorkers();
			}

			pm.send({ command: 'beginInterval', interval: samplerInit.interval });
		}, samplerInit.interval);

		mithril.on('shutdown', function () {
			clearInterval(sampleInterval);
		});

		return;
	}

	if (pm.isWorker) {
		process.on('message', function (message) {
			if (message && message.command === 'beginInterval') {
				panopticon.beginInterval(message.interval);
			}
		});


		// panopticon has finished sampling, and wants to deliver data. We tell it to deliver the data to master.
		panopticon.on('sampleSet', function (data) {
			pm.send({ event: 'sampleSet', data: data });
		});


		// Tell panopticon to clear timer.
		mithril.on('shutdown', function () {
			panopticon.stop();
		});
	}
};


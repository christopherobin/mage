var mage = require('../../mage');
var State = mage.core.State;
var httpServer = mage.core.httpServer;
var logger = mage.core.logger.context('cronClient');
var cfg = mage.core.config.get(['module', 'cronClient']);

if (!cfg) {
	throw new Error('Please configure: module.cronClient');
}

var serverAppId = cfg.serverAppId;
var serverEndpoint = cfg.serverBaseUrl;
var clientAppId = cfg.clientAppId;
var clientEndpoint = cfg.clientBaseUrl || httpServer.getClientHostBaseUrl();

// config assertions

if (!clientAppId) {
	throw new Error('Please configure: module.cronClient.clientAppId');
}

if (!clientEndpoint) {
	throw new Error('Please configure: module.cronClient.clientBaseUrl or server.clientHost.expose');
}

if (!serverAppId) {
	throw new Error('Please configure: module.cronClient.serverAppId');
}

if (!serverEndpoint) {
	throw new Error('Please configure: module.cronClient.serverBaseUrl');
}

logger.debug.data({
	serverAppId: serverAppId,
	serverEndpoint: serverEndpoint,
	clientAppId: clientAppId
}).log('Setting up cronClient');

var client = new mage.core.CommandCenterClient(serverAppId, serverEndpoint, logger);

var callbacks = {};


/**
 * Sets up a job for scheduled execution
 *
 * @param {string}        jobId      A unique ID for this job.
 * @param {string|number} schedule   A timestamp or crontab-formatted schedule (optionally with a seconds column).
 * @param {string}        [timezone] An optional timezone (not applicable to timestamps)
 * @param {Function}      cb         The function to run according to the given schedule. Receives State and callback.
 */

exports.setJob = function (jobId, schedule, timezone, cb) {
	if (typeof timezone === 'function') {
		cb = timezone;
	} else {
		schedule = {
			schedule: schedule,
			timezone: timezone
		};
	}

	if (cb.length !== 2 && cb.length !== 3) {
		throw new TypeError(
			'setJob callback signature must be either (state, cb) or (state, message, cb)'
		);
	}

	client.send('cronServer.setJob', {
		endpoint: clientEndpoint,
		appId: clientAppId,
		jobId: jobId,
		schedule: schedule
	});

	callbacks[jobId] = cb;
};


/**
 * This should be called when the cronServer has called back to run a registered job.
 * We never remove a registered callback, because a job may be run more than once.
 *
 * @param {string} jobId   A unique ID for the job to execute.
 * @param {Object} [message]  A Shokoti server may choose to send extra data with the job
 */

exports.runJob = function (jobId, message) {
	message = message || { meta: {} };

	var cb = callbacks[jobId];
	if (!cb) {
		var maxLength = 10;

		var available = Object.keys(callbacks);
		var dropped = available.splice(maxLength, available.length);

		if (dropped.length > 0) {
			available.push(dropped.length + ' more...');
		}

		logger.error.data('Available job IDs', available).log(
			'No callback queued up for jobId:', jobId
		);
		return;
	}

	var startTime = process.hrtime();

	logger.notice.data(message).log('Starting cron job:', jobId);

	var state = new State();

	state.setDescription('CronJob "' + jobId + '"');

	function callback() {
		state.close(function () {
			var durationRaw = process.hrtime(startTime);
			var duration = durationRaw[0] + durationRaw[1] / 1e9;

			logger.notice
				.data({ durationSec: duration })
				.log('Completed cron job:', jobId);
		});
	}

	setImmediate(function () {
		if (cb.length === 2) {
			cb(state, callback);
		} else if (cb.length === 3) {
			cb(state, message, callback);
		}
	});
};

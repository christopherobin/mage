var mage = require('../../mage');
var State = mage.core.State;
var logger = mage.core.logger.context('cronClient');

var client;
var clientAppId;
var clientEndpoint;

var callbacks = {};


exports.setup = function (state, cb) {
	var cfg = mage.core.config.get(['module', 'cronClient']);

	var serverAppId = cfg.serverAppId;
	var serverEndpoint = cfg.serverBaseUrl;
	clientAppId = cfg.clientAppId;
	clientEndpoint = cfg.clientBaseUrl || mage.core.msgServer.getClientHost().getClientHostBaseUrl();

	if (!clientAppId) {
		return state.error(null, 'Please configure: module.cronClient.clientAppId', cb);
	}

	if (!clientEndpoint) {
		return state.error(null, 'Please configure: module.cronClient.clientBaseUrl or server.clientHost.expose', cb);
	}

	if (!serverAppId) {
		return state.error(null, 'Please configure: module.cronClient.serverAppId', cb);
	}

	if (!serverEndpoint) {
		return state.error(null, 'Please configure: module.cronClient.serverBaseUrl', cb);
	}

	logger.debug('Setting up cronClient to connect to', serverAppId, 'at', serverEndpoint, 'on behalf of app:', clientAppId);

	client = new mage.core.CommandCenterClient(serverAppId, serverEndpoint, logger);

	cb();
};


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
	message = message || {};

	var cb = callbacks[jobId];
	if (!cb) {
		var maxLength = 10;

		var available = Object.keys(callbacks);
		var dropped = available.splice(maxLength, available.length);

		if (dropped.length > 0) {
			available.push(dropped.length + ' more...');
		}

		logger.error.data('Available job IDs', available).log('No callback queued up for jobId:', jobId);
		return;
	}

	var startTime = process.hrtime();

	logger.notice.data(message).log('Starting cron job:', jobId);

	var state = new State();

	state.setDescription('CronJob "' + jobId + '"');

	process.nextTick(function () {
		cb(state, function () {
			state.close(function () {
				var durationRaw = process.hrtime(startTime);
				var duration = durationRaw[0] + durationRaw[1] / 1e9;

				logger.notice
					.data({ durationSec: duration })
					.log('Completed cron job:', jobId);
			});
		});
	});
};

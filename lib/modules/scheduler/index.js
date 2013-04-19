var mage = require('../../mage');
var logger = mage.core.logger.context('scheduler');
var HeartBeat = require('./HeartBeat');
var Duration = require('./Duration');
var Cron = require('./Cron');
var Schedule = require('./Schedule');
var CommandCenterClient = require('./CommandCenterClient');
var url = require('url');

var config = mage.core.config;

var commandCenterClient;


/**
 * Helper function to determine if s is a string and hide the ugliness of the check.
 *
 * @param s
 * @return {Boolean}
 * @private
 */

function isString(s) {
	return Object.prototype.toString.call(s) === "[object String]";
}


/**
 * Initialises the commandCenterClient singleton if necessary, returns singleton.
 *
 * @return {CommandCenterClient}
 * @private
 */

function getCommandCenterClient() {
	if (!(commandCenterClient instanceof CommandCenterClient)) {
		commandCenterClient = new CommandCenterClient({
			app: config.get('module.scheduler.name', 'shokoti'),
			host: config.get('module.scheduler.host'),
			port: config.get('module.scheduler.port', 80),
			auth: config.get('module.scheduler.auth')
		});
	}

	return commandCenterClient;
}


/**
 * Send commands to schedule server.
 *
 * @param {String} commandName
 * @param {Object} params
 * @param {Function} cb Callback
 * @private
 */

function sendCommand(commandName, params, cb) {
	getCommandCenterClient().send('schedulerServer.' + commandName, params);
	cb();
}

var taskIdToCode = {};


/**
 * Construct a taskId from app name and task name.
 *
 * @param {String} appName
 * @param {String} taskName
 * @return {String}
 * @private
 */

function makeTaskId(appName, taskName) {
	return appName + ':' + taskName;
}


/**
 * Locates and returns function associated with app and task. Returns undefined if no function is
 * associate.
 *
 * @param appName
 * @param taskName
 * @return {Function|Undefined}
 * @private
 */

function lookupCode(appName, taskName) {
	if (!isString(appName) && !isString(taskName)) {
		logger.error(new TypeError('Neither appName nor TaskName was a string: appName: ' + appName + ' taskName: ' + taskName));
		return;
	}

	var code = taskIdToCode[makeTaskId(appName, taskName)];

	if (typeof code === "function") {
		return code;
	}

	logger.debug('Unknown task', taskName, 'for app', appName, 'Ignoring...');
	return;
}

// Expose classes via this module.
exports.HeartBeat = HeartBeat;
exports.Duration = Duration;
exports.Cron = Cron;
exports.Schedule = Schedule;


/**
 * Run a registered task now.
 *
 * @param {String} appName
 * @param {String} taskName
 * @param {Object} data
 */

exports.runNow = function (appName, taskName, data) {
	var code = lookupCode(appName, taskName);
	if (!code) {
		return logger.error('Scheduler: No code found for task:', taskName, 'and app', appName);
	}

	logger.debug('Scheduler: Executing task', taskName, 'for app', appName);
	code(data);
};


/**
 * Register new code to be run later. Should be called at startup time only.
 *
 * @param {String} appName
 * @param {String} taskName
 * @param {Function} code
 */

exports.register = function (appName, taskName, code) {
	if (!isString(appName) || !isString(taskName) || typeof code !== "function") {
		throw new Error('Invalid arguments');
	}

	var app = mage.core.app.get(appName);

	if (!app) {
		throw new Error('Unknown app: ' + appName);
	}

	// Expose the runTask command if it hasn't been exposed yet
	if (!app.commandCenter.getModuleCommands('scheduler').runTask) {
		app.commandCenter.expose({}, { scheduler: ['runTask'] });
	}

	var taskId = makeTaskId(appName, taskName);
	if (taskIdToCode[taskId]) {
		logger.error('Overwriting previously-registered task', taskName, 'for app', appName);
	}

	taskIdToCode[taskId] = code;
};


/**
 * Parse the schedule.
 *
 * @param {String} schedule.
 * @return {Object} A Date, a Cron or a HeartBeat object.
 */

exports.parseSchedule = function (schedule) {
	var parsed = Number(schedule);
	if (!isNaN(parsed)) {
		schedule = parsed;
	}

	if (Number.isFinite(schedule)) {
		// We got a number of milliseconds.
		// Treat huge values (tens of years) as dates, otherwise treat them as periods.
		parsed = new Date(schedule);
		if (parsed.getFullYear() > 2010) {
			schedule = parsed;
		} else {
			schedule = new HeartBeat(schedule);
		}
	}

	if (isString(schedule)) {
		parsed = new Cron(schedule);
		if (!parsed.isInvalid()) {
			schedule = parsed;
		} else {
			parsed = new HeartBeat(schedule);
			if (!parsed.isInvalid()) {
				schedule = parsed;
			}
		}
	}

	if (schedule instanceof Date) {
		schedule = new HeartBeat(1, schedule, schedule);
	} else if (schedule instanceof Duration) {
		schedule = new HeartBeat(schedule);
	}

	return (schedule instanceof Schedule) && !schedule.isInvalid() ? schedule : null;
};


/**
 * Schedule a task.
 *
 * @param {String} appName
 * @param {String} taskName
 * @param {Object|String} schedule A Date, Cron, Duration or HeartBeat object, or a String representing them.
 * @param {Object} data
 * @param {Function} cb Callback
 */

exports.schedule = function (appName, taskName, schedule, data, cb) {
	var state = new mage.core.State();

	function finalCb() {
		state.close();
		cb.apply(this, arguments);
	}

	var code = lookupCode(appName, taskName);
	if (!code) {
		return state.error(null, 'Unknown app/task', finalCb);
	}

	schedule = exports.parseSchedule(schedule);

	if (!schedule) {
		return state.error(null, 'Invalid schedule', finalCb);
	}

	var baseUrl = url.parse(mage.core.msgServer.getClientHost().getClientHostBaseUrl());

	var params = {
		// The app's name/host/port is needed so that the scheduler server knows which app it
		// should send its commands to.
		client: {
			app: appName,
			host: baseUrl.hostname,
			port: baseUrl.port || 80
		},
		taskName: taskName,
		schedule: schedule
	};

	// Adds the optional Basic Authentication info
	var auth = config.get('module.scheduler.callbackAuth');
	if (auth) {
		params.client.auth = auth;
	}

	if (data) {
		params.data = data;
	}

	logger.info('scheduling task', appName + "/" + taskName, 'to run on', schedule);

	sendCommand("scheduleTask", params, finalCb);
};

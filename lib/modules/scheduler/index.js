"use strict";

var mithril = require('mithril'),
	logger = mithril.core.logger,
	HeartBeat = require('./heartBeat'),
	Duration = require('./duration'),
	Cron = require('./cron'),
	Schedule = require('./schedule'),
	CommandCenterClient = require('./commandCenterClient'),
	commandCenterClient,
	getCommandCenterClient = function () {
		if (!(commandCenterClient instanceof CommandCenterClient)) {
			commandCenterClient = new CommandCenterClient({
				app: mithril.core.config.get('module.scheduler.name', 'shokoti'),
				host: mithril.core.config.get('module.scheduler.host'),
				port: mithril.core.config.get('module.scheduler.port')
			});
		}

		return commandCenterClient;
	},
	sendCommand = function (commandName, params, cb) {
		getCommandCenterClient().send('schedulerServer.' + commandName, params, cb);
	},
	taskIdToCode = {},
	makeTaskId = function (appName, taskName) {
		return appName + ':' + taskName;
	},
	lookupCode = function (appName, taskName) {
		if (Object.prototype.toString.call(appName) === "[object String]" ||
			Object.prototype.toString.call(taskName) === "[object String]"
		) {
			var code = taskIdToCode[makeTaskId(appName, taskName)];
			if (typeof code === "function") {
				return code;
			}
			logger.debug("Unknown task '" + taskName + "' for app '" + appName + "'. Ignoring...");
		} else {
			logger.error(new TypeError());
		}
	};

// Convenience exports
exports.HeartBeat = HeartBeat;
exports.Duration = Duration;
exports.Cron = Cron;
exports.Schedule = Schedule;

/**
 * Run a registered task, now.
 *
 * @param {String} appName
 * @param {String} taskName
 * @param {Object} data
 * @api public
 */
exports.runNow = function (appName, taskName, data) {
	var code = lookupCode(appName, taskName);
	if (code) {
		logger.debug("Scheduler: Executing task '" + taskName + "' for app '" + appName + "'...");
		code(data);
	}
};

/**
 * Register new code to be run later. Should be called at startup time only.
 *
 * @param {String} appName
 * @param {String} taskName
 * @param {Function} code
 * @api public
 */
exports.register = function (appName, taskName, code) {
	if (Object.prototype.toString.call(appName) !== "[object String]" ||
		Object.prototype.toString.call(taskName) !== "[object String]" ||
		typeof code !== "function"
	) {
		mithril.fatalError('Invalid arguments');
	}

	var app = mithril.core.app.get(appName);
	if (!app) {
		mithril.fatalError('Unknown app: ' + appName);
	}

	// Expose the runTask command if it hasn't been exposed yet
	if (!app.commandCenter.getModuleCommands('scheduler').runTask) {
		app.commandCenter.expose({}, {scheduler: ['runTask']});
	}

	var taskId = makeTaskId(appName, taskName);
	if (taskIdToCode[taskId]) {
		logger.error('Overwriting previously-registered task ' + taskName + ' for app ' + appName);
	}

	taskIdToCode[taskId] = code;
};

/**
 * Parse the schedule.
 *
 * @param {String} schedule.
 * @return {Object} A Date, a Cron or a HeartBeat object.
 * @api public
 */
exports.parseSchedule = function (schedule) {
	var parsed = Number(schedule);
	if (!isNaN(parsed)) {
		schedule = parsed;
	}

	if (Object.prototype.toString.call(schedule) === "[object Number]") {
		// We got a number of milliseconds.
		// Treat huge values (tens of years) as dates, otherwise treat them as periods.
		parsed = new Date(schedule);
		if (parsed.getFullYear() > 2010) {
			schedule = parsed;
		} else {
			schedule = new HeartBeat(schedule);
		}
	}

	if (Object.prototype.toString.call(schedule) === "[object String]") {
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
 * @param {Object} schedule A Date, Cron, Duration or HeartBeat object, or a String representing them.
 * @param {Object} data
 * @api public
 */
exports.schedule = function (appName, taskName, schedule, data) {
	var code = lookupCode(appName, taskName);
	if (!code) {
		return false;
	}

	schedule = exports.parseSchedule(schedule);

	if (!schedule) {
		logger.error("Invalid schedule");
		return false;
	}

	var params = {
		// The app's name/host/port is needed so that the scheduler server knows which app it
		// should send its commands to.
		client: {
			app: appName,
			host: mithril.core.config.get('server.clientHost.expose.host'),
			port: mithril.core.config.get('server.clientHost.expose.port')
		},
		taskName: taskName,
		schedule: schedule
	};
	if (data) {
		params.data = data;
	}

	mithril.core.logger.info("Scheduling task " + appName + "/" + taskName + " to run on " + JSON.stringify(schedule));
	sendCommand("scheduleTask", params);
};

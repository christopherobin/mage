var mage = require('../../mage');
var Registry = require('./Registry');

var registry = null;


/**
 * Module setup function initialises registry in active memory.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.setup = function (state, cb) {
	var cfg = mage.core.config.get('module.schedulerServer');
	var options = {};

	if (cfg && cfg.debug) {
		// Use a debug prefix and a short TTL.
		options.prefix = '' + Date.now();
		options.ttl = 600;
		mage.core.logger.notice('SchedulerServer: Debug activated. Using prefix ' + options.prefix + ' and ttl=' + options.ttl + '.');
	} else {
		// Use no prefix and persist things forever.
		mage.core.logger.notice('SchedulerServer: Production mode.');
	}

	registry = new Registry(options);
	exports.reload(state, cb);
};


/**
 * // TODO Generic getManageCommand description.
 *
 * @return {Array}
 */

exports.getManageCommands = function () {
	return [
		'listSchedules',
		'nuke',
		'reload',
		'shutdown',
		'getScheduleInfo'
	];
};


/**
 * Exposes the registry instance scheduleCommand.
 *
 * {Object} state
 * {} client // TODO What type?
 * {String} taskName
 * {} scheduleInfo // TODO What type?
 * {Object} data // TODO What type?
 * {Function} cb
 */

exports.scheduleCommand = function (state, client, taskName, scheduleInfo, data, cb) {
	registry.scheduleCommand(state, client, taskName, scheduleInfo, data, cb);
};


/**
 * Exposes the registry instance reloadFromStore command.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.reload = function (state, cb) {
	registry.reloadFromStore(state, cb);
};


/**
 * Queries registry.infos.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.listSchedules = function (state, cb) {
	state.respond(registry.infos);
	cb();
};


/**
 * Gets information on a particular schedule key.
 *
 * @param {Object} state
 * @param {String} scheduleKey
 * @param {Function} cb
 */

exports.getScheduleInfo = function (state, scheduleKey, cb) {
	var Cron = mage.scheduler.Cron;
	var HeartBeat = mage.scheduler.HeartBeat;

	// Clone the schedule so we can iterate thru it without messing with the original
	var original = registry.schedules[scheduleKey];
	var schedule;

	if (original instanceof Cron) {
		schedule = new Cron(original);
	} else if (original instanceof HeartBeat) {
		schedule = new HeartBeat(original);
	} else {
		return state.error(null, "Unknown schedule", cb);
	}

	var response = {
		key: scheduleKey,
		info: registry.infos[scheduleKey],
		nextEvents: [],
		tasks: []
	};

	// Get the next 20 events
	for (var i = 0, e = schedule.getNextEvent(); i < 20 && e; i++, e = schedule.getNextEvent(e)) { // TODO yuck
		response.nextEvents.push(e);
	}

	// List the tasks that must be invoked
	var taskKeys = registry.tasksForSchedule[scheduleKey];

	for (var taskKey in taskKeys) {
		if (taskKeys.hasOwnProperty(taskKey)) {
			var key = taskKeys[taskKey];
			var task = registry.tasks[key];
			if (task) {
				response.tasks.push({
					key   : key,
					client: task.client,
					name  : task.taskName,
					data  : task.data
				});
			}
		}
	}

	state.respond(response);
	cb();
};


/**
 * Removes the state of the registry from the datastore.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.nuke = function (state, cb) {
	registry.nukeStore(state, cb);
};


/**
 * Calls registry.shutdown.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.shutdown = function (state, cb) {
	registry.shutdown();
	cb();
};

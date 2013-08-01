var mage = require('../../mage');
var logger = mage.core.logger.context('schedulerServer');
var Registry = require('./Registry');

var registry;


/**
 * Module setup function initialises registry in active memory.
 *
 * @param {Object} state
 * @param {Function} cb
 */

exports.setup = function (state, cb) {
	var prefix;
	var ttl;

	if (mage.isDevelopmentMode()) {
		// Use a debug prefix and a short TTL.
		prefix = '' + Date.now() + '/';
		ttl = 600;
		logger.info('Debug activated. Using prefix', prefix, 'and ttl:', ttl);
	} else {
		// Use no prefix and persist things forever.
		logger.debug('Production mode.');
	}

	registry = new Registry(prefix, ttl);
	exports.reload(state, cb);
};


/**
 * Exposes the registry instance scheduleCommand.
 *
 * {Object}        state
 * {Object}        client       Client endpoint, eg: { app: 'game', host: 'localhost', port: 80, auth: 'base64str' }
 * {String}        taskName
 * {Object|String} scheduleInfo
 * {Object}        data // TODO What type?
 * {Function}      cb           Callback function may receive an error as an argument.
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
		return state.error(null, 'Unknown schedule', cb);
	}

	var response = {
		key: scheduleKey,
		info: registry.infos[scheduleKey],
		nextEvents: [],
		tasks: []
	};

	var e = schedule.getNextEvent();

	// Get up to 20 of the next events.
	while (response.nextEvents.length < 20 && e) {
		response.nextEvents.push(e);
		e = schedule.getNextEvent();
	}

	// List the tasks that must be invoked
	var taskKeys = registry.tasksForSchedule[scheduleKey];

	for (var taskKey in taskKeys) {
		if (taskKeys.hasOwnProperty(taskKey)) {
			var key = taskKeys[taskKey];
			var task = registry.tasks[key];

			if (task) {
				response.tasks.push({
					key: key,
					client: task.client,
					name: task.taskName,
					data: task.data
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

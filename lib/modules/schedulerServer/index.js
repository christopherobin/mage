"use strict";

var mithril = require('../../mithril'),
	Registry = require('./registry'),
	Cron = require('../scheduler/cron'),
	HeartBeat = require('../scheduler/heartBeat');

module.exports = {
	setup: function (state, cb) {
		var cfg = mithril.core.config.get('module.schedulerServer'),
			options = {};

		if (cfg && cfg.debug) {
			// Use a debug prefix and a short TTL.
			options.prefix = '' + Date.now();
			options.ttl = 600;
			mithril.core.logger.info('SchedulerServer: Debug activated. Using prefix ' + options.prefix + ' and ttl=' + options.ttl + '.');
		} else {
			// Use no prefix and persist things forever.
			mithril.core.logger.info('SchedulerServer: Production mode.');
		}

		this.registry = new Registry(options);
		this.reload(state, cb);
	},
	getManageCommands: function () {
		return [
			'listSchedules',
			'nuke',
			'reload',
			'shutdown',
			'getScheduleInfo'
		];
	},
	// user commands
	scheduleCommand: function (state, client, taskName, scheduleInfo, data, cb) {
		this.registry.scheduleCommand(state.datasources.kv, client, taskName, scheduleInfo, data, cb);
	},
	reload: function (state, cb) {
		this.registry.reloadFromStore(state.datasources.kv, cb);
	},
	listSchedules: function (state, cb) {
		state.respond(this.registry.infos);
		cb();
	},
	getScheduleInfo: function (state, scheduleKey, cb) {
		// Clone the schedule so we can iterate thru it without messing with the original
		var original = this.registry.schedules[scheduleKey], schedule;
		if (original instanceof Cron) {
			schedule = new Cron(original);
		} else if (original instanceof HeartBeat) {
			schedule = new HeartBeat(original);
		}

		if (!schedule) {
			return cb("Unknown schedule");
		}

		var response = {
			key: scheduleKey,
			info: this.registry.infos[scheduleKey],
			nextEvents: [],
			tasks: []
		};

		// Get the next 20 events
		for (var e, i = 0; (i < 20) && (e = schedule.getNextEvent(e)); ++i) {
			response.nextEvents.push(e);
		}

		// List the tasks that must be invoked
		var taskKeys = this.registry.tasks_for_schedule[scheduleKey];
		for (var taskKey in taskKeys) {
			taskKey = taskKeys[taskKey];
			var task = this.registry.tasks[taskKey];
			if (!task) {
				// We already log that kind of error when we invoke the tasks
				continue;
			}
			response.tasks.push({
				key: taskKey,
				client: task.client,
				name: task.taskName,
				data: task.data
			});
		}

		state.respond(response);
		cb();
	},
	nuke: function (state, cb) {
		this.registry.nukeStore(state.datasources.kv, cb);
	},
	shutdown: function (state, cb) {
		this.registry.shutdown();
		cb();
	}
};

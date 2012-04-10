"use strict";

var mithril = require('../../mithril');
var CommandCenterClient = require('../scheduler/commandCenterClient');
var scheduler = require('../scheduler'),
	Schedule = scheduler.Schedule,
	Cron = scheduler.Cron,
	HeartBeat = scheduler.HeartBeat;



// Create safe memcache keys out of composite objects
var crypto = require('crypto');
var sortedJSON = function (obj) {
	if (obj === null) {
		return 'null';
	}

	if (Array.isArray(obj)) {
		return '[' + obj.map(sortedJSON).join(',') + ']';
	}

	if (obj instanceof RegExp) {
		return sortedJSON(obj.source);
	}

	if (typeof obj === "object" && !(obj instanceof Date)) {
		return '{' + Object.keys(obj).sort().map(function (key) {
			return [key, sortedJSON(obj[key])];
		}).filter(function (tuple) {
			return typeof tuple[1] !== "undefined";
		}).map(function (tuple) {
			return '"' + tuple[0] + '": ' + tuple[1];
		}).join(', ') + '}';
	}

	return JSON.stringify(obj);
};
var stableHash = function () {
	var h = crypto.createHmac('sha1', '');
	for (var i in arguments) {
		h.update(sortedJSON(arguments[i]));
	}
	// return the digest as unpadded base64
	return new Buffer(h.digest('binary'))
		.toString('base64')
		.replace(/\=+$/g, '');
};

var SCHEDULES_KEY, SCHEDULE_KEY_PREFIX, TASK_KEY_PREFIX, TTL;

var ScheduleCollection = {
	// schedule key > Schedule mapping
	schedules: {},
	// task key > task description mapping
	tasks: {},
	// schedule key > list of task keys mapping
	tasks_for_schedule: {},
	// schedule key > schedule info string mapping
	infos: {},
	// task key > command center client mapping
	peers: {},
	invokeTasks: function (key, date) {
		date = date || new Date();
		mithril.core.logger.debug('SchedulerServer: Invoking tasks for schedule ' + String(this.infos[key]));

		var taskKeys = this.tasks_for_schedule[key] || [];
		for (var taskKey in taskKeys) {
			taskKey = taskKeys[taskKey];
			var task = this.tasks[taskKey];
			if (!task) {
				mithril.core.logger.debug('SchedulerServer: Can\'t find task for key ' + JSON.stringify(taskKey));
				continue;
			}

			if (!this.peers[taskKey]) {
				this.peers[taskKey] = new CommandCenterClient(task.client);
			}

			var params = {
				appName: task.client.app,
				taskName: task.taskName,
				data: task.data
			};

			mithril.core.logger.debug('SchedulerServer: Invoking task ' + task.taskName + ' on app ' + task.client.app);
			this.peers[taskKey].send('scheduler.runTask', params);
		}
	},
	deleteTask: function (key, dont_cancel_empty_schedules) {
		var task = this.tasks[key];
		if (!task) {
			return undefined;
		}
		mithril.core.logger.debug('SchedulerServer: Deleting task ' + task.taskName + ' of app ' + task.client.app);

		var schedule = task.schedule;
		// Unschedule it
		if (this.tasks_for_schedule[schedule]) {
			var index = this.tasks_for_schedule[schedule].indexOf(key);
			if (index >= 0) {
				this.tasks_for_schedule[schedule].splice(index, 1);
				if (this.tasks_for_schedule[schedule].length === 0) {
					mithril.core.logger.debug('SchedulerServer: Schedule ' + this.infos[schedule] + ' is empty.');
					if (!dont_cancel_empty_schedules) {
						this.shutdown(schedule);
					}
				}
			}
		}

		// Delete it
		delete this.tasks[key];
		delete this.peers[key];

		return schedule;
	},
	addTask: function (key, task) {
		if (this.tasks[key]) {
			return false;
		}

		if (!this.tasks_for_schedule[task.schedule]) {
			return false;
		}

		this.tasks[key] = task;
		this.tasks_for_schedule[task.schedule].push(key);
		return true;
	},
	createSchedule: function (key, info, delete_existing) {
		if (this.infos[key] && !delete_existing) {
			return true;
		}

		if (typeof info === 'object') {
			info = sortedJSON(info);
		}

		// Delete old schedule
		this.shutdown(key);

		// Create new one
		var schedule = scheduler.parseSchedule(info);
		if (!schedule || schedule.isInvalid()) {
			mithril.core.logger.error('Invalid schedule spec: ' + info);
			return false;
		}

		this.schedules[key] = schedule;
		this.tasks_for_schedule[key] = [];
		this.infos[key] = info;

		var that = this;

		this.schedules[key].on('run', function (date) {
			that.invokeTasks(key, date);
		});

		this.schedules[key].on('end', function () {
			mithril.core.logger.debug('SchedulerServer: schedule ' + info + ' just ended.');
			that.shutdown(key);
		});

		this.schedules[key].on('cancel', function () {
			mithril.core.logger.debug('SchedulerServer: schedule ' + info + ' was canceled.');
			// schedules only get canceled by the shutdown() method
		});

		mithril.core.logger.debug('SchedulerServer: Created schedule ' + info);
		this.schedules[key].run();

		return true;
	},
	shutdown: function (only_for_key) {
		if (!only_for_key) {
			mithril.core.logger.debug('SchedulerServer: Shutting down...');
		}

		for (var key in this.schedules) {
			if (only_for_key && (key !== only_for_key)) {
				continue;
			}

			// Cancel the schedule
			if (this.schedules[key] instanceof Schedule) {
				this.schedules[key].removeAllListeners();
				this.schedules[key].cancel();
			}

			// Wipe out dependent tasks
			this.tasks_for_schedule[key] = this.tasks_for_schedule[key] || [];
			for (var taskKey in this.tasks_for_schedule[key]) {
				taskKey = this.tasks_for_schedule[key][taskKey];
				delete this.tasks[taskKey];
			}
			delete this.tasks_for_schedule[key];

			// Delete old stuff
			delete this.infos[key];
			delete this.schedules[key];
		}
	},
	reloadFromStore: function (store, cb) {
		mithril.core.logger.debug('SchedulerServer: Reloading state from store...');

		// wipe out everything
		this.shutdown();

		var that = this;
		var error = function (err) {
			mithril.core.logger.error('SchedulerServer: Got an error while reloading state from store ー ' + err);
			that.shutdown();
			cb(err);
		};

		// Read the master list
		store.getOne(SCHEDULES_KEY, false, null, function (err, schedules) {
			if (err) {
				return error(err);
			}

			// Instantiate the schedules
			var scheduleKeys = [];
			for (var schedule in schedules) {
				scheduleKeys.push(schedule);
				if (!that.createSchedule(schedule, schedules[schedule])) {
					return error("Invalid schedule '" + JSON.stringify(schedules[schedule]) + "'");
				}
			}

			// Nothing left to do?
			if (scheduleKeys.length === 0) {
				return cb();
			}

			store.getMany(scheduleKeys, null, function (err, taskIndex) {
				if (err) {
					return error(err);
				}

				// Get all the tasks' keys
				var allTaskKeys = [];
				for (var scheduleKey in schedules) {
					var taskKeys = taskIndex[scheduleKey] || [];

					for (var i in taskKeys) {
						allTaskKeys.push(taskKeys[i]);
					}
				}

				// Nothing left to do?
				if (allTaskKeys.length === 0) {
					return cb();
				}

				// Load all tasks
				store.getMany(allTaskKeys, null, function (err, allTasks) {
					if (err) {
						return error(err);
					}

					// Instantiate the tasks
					for (var taskKey in allTasks) {
						var task = allTasks[taskKey];
						that.tasks[taskKey] = task;
						that.tasks_for_schedule[task.schedule] = that.tasks_for_schedule[task.schedule] || [];
						that.tasks_for_schedule[task.schedule].push(taskKey);
					}

					return cb();
				});
			});
		});
	}
};

exports.setup = function (state, cb) {
	var cfg = mithril.core.config.get('module.schedulerServer');

	if (cfg && cfg.debug) {
		// Use a debug prefix and a short TTL.
		var prefix = '' + Date.now();
		SCHEDULES_KEY = prefix + '_schedules';
		TASK_KEY_PREFIX = prefix + '_tasks/';
		TTL = 600;
		mithril.core.logger.debug('SchedulerServer: Debug activated. Using prefix ' + prefix + ' and ttl=' + TTL + '.');
	} else {
		// Use a constant prefix and persist things forever.
		SCHEDULES_KEY = 'schedules';
		TASK_KEY_PREFIX = 'tasks';
		TTL = 0;
		mithril.core.logger.debug('SchedulerServer: Production mode.');
	}

	SCHEDULE_KEY_PREFIX = SCHEDULES_KEY + '/';

	ScheduleCollection.reloadFromStore(state.datasources.kv, cb);
};

exports.scheduleCommand = function (state, client, taskName, scheduleInfo, data, cb) {
	var kv = state.datasources.kv,
		scheduleKey = SCHEDULE_KEY_PREFIX + stableHash(scheduleInfo),
		taskKey = TASK_KEY_PREFIX + stableHash(client, taskName),
		masterListDirty;

	// Create the new schedule if it doesn't exist yet
	if (!ScheduleCollection.schedules[scheduleKey]) {
		if (!ScheduleCollection.createSchedule(scheduleKey, scheduleInfo)) {
			return cb("Invalid schedule " + JSON.stringify(scheduleInfo));
		}
		masterListDirty = true;
	}

	// Unschedule task if it exists already
	var oldScheduleKey = ScheduleCollection.deleteTask(taskKey);
	if (oldScheduleKey && (oldScheduleKey !== scheduleKey)) {
		var list = ScheduleCollection.tasks_for_schedule[oldScheduleKey];
		if (list && list.length) {
			kv.set(oldScheduleKey, list, TTL);
		} else {
			// old schedule has been deleted
			kv.del(oldScheduleKey);
			masterListDirty = true;
		}
	}

	// Schedule it
	var task = {
		schedule: scheduleKey,
		client: client,
		taskName: taskName,
		data: data
	};

	if (!ScheduleCollection.addTask(taskKey, task)) {
		return cb("Can't add task " + JSON.stringify(task));
	}

	// Persist task
	kv.set(taskKey, task, TTL);
	kv.set(scheduleKey, ScheduleCollection.tasks_for_schedule[scheduleKey], TTL);
	if (masterListDirty) {
		kv.set(SCHEDULES_KEY, ScheduleCollection.infos, TTL);
	}

	return cb();
};

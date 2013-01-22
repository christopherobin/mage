"use strict";

var crypto = require('crypto'),
	mage = require('mage'),
	scheduler = require('../scheduler'),
	Schedule = scheduler.Schedule,
	CommandCenterClient = require('../scheduler/commandCenterClient');

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
				return tuple[1] !== undefined;
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

var Registry = function Registry(options) {
	// config
	this.prefix = options.prefix || '';
	this.ttl = options.ttl || 0;

	this.masterKey = this.prefix + 'schedules';
	this.scheduleKeysPrefix = this.prefix + 'schedules/';
	this.taskKeysPrefix = this.prefix + 'tasks/';

	// schedule key > Schedule mapping
	this.schedules = {};

	// task key > task description mapping
	this.tasks = {};

	// schedule key > list of task keys mapping
	this.tasks_for_schedule = {};

	// schedule key > schedule info string mapping
	this.infos = {};

	// task key > command center client mapping
	this.peers = {};
};

module.exports = Registry;

Registry.prototype = {
	constructor: Registry,
	keyFromScheduleInfo: function (scheduleInfo) {
		return this.scheduleKeysPrefix + stableHash(scheduleInfo);
	},
	keyFromTaskName: function (client, taskName) {
		return this.taskKeysPrefix + stableHash(client, taskName);
	},
	invokeTasks: function (key, date) {
		date = date || new Date();
		mage.core.logger.debug('SchedulerServer: Invoking tasks for schedule ' + String(this.infos[key].spec));

		var taskKeys = this.tasks_for_schedule[key] || [];
		for (var taskKey in taskKeys) {
			taskKey = taskKeys[taskKey];
			var task = this.tasks[taskKey];
			if (!task) {
				mage.core.logger.debug("SchedulerServer: Can't find task for key " + JSON.stringify(taskKey));
				continue;
			}
			mage.core.logger.debug('SchedulerServer: Task key = ' + JSON.stringify(taskKey));

			if (!this.peers[taskKey]) {
				this.peers[taskKey] = new CommandCenterClient(task.client);
			}

			var params = {
				appName: task.client.app,
				taskName: task.taskName,
				data: task.data
			};

			mage.core.logger.info('Invoking task "' + task.taskName + '" on app "' + task.client.app + '" at ' + task.client.host + ':' + task.client.port);
			this.peers[taskKey].send('scheduler.runTask', params);
		}
	},
	deleteTask: function (key, dont_cancel_empty_schedules) {
		var task = this.tasks[key];
		if (!task) {
			return;
		}
		mage.core.logger.debug('SchedulerServer: Deleting task ' + task.taskName + ' of app ' + task.client.app);

		var schedule = task.schedule;
		// Unschedule it
		if (this.tasks_for_schedule[schedule]) {
			var index = this.tasks_for_schedule[schedule].indexOf(key);
			if (index >= 0) {
				this.tasks_for_schedule[schedule].splice(index, 1);
				if (this.tasks_for_schedule[schedule].length === 0) {
					mage.core.logger.debug('SchedulerServer: Schedule ' + this.infos[schedule].spec + ' is empty.');
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
			mage.core.logger.error('Invalid schedule spec: ' + info);
			return false;
		}

		this.schedules[key] = schedule;
		this.tasks_for_schedule[key] = [];
		this.infos[key] = {
			spec: info
		};

		// This info is only ever used by the tool
		if (schedule instanceof scheduler.Cron) {
			this.infos[key].type = 'Cron';
		} else if (schedule instanceof scheduler.HeartBeat) {
			this.infos[key].type = 'HeartBeat';
		}

		var that = this;

		this.schedules[key].on('run', function (date) {
			that.invokeTasks(key, date);
		});

		this.schedules[key].on('end', function () {
			mage.core.logger.debug('SchedulerServer: schedule ' + info + ' just ended.');
			that.shutdown(key);
		});

		this.schedules[key].on('cancel', function () {
			mage.core.logger.debug('SchedulerServer: schedule ' + info + ' was canceled.');
			// schedules only get canceled by the shutdown() method
		});

		mage.core.logger.debug('SchedulerServer: Created schedule ' + info);
		this.schedules[key].run();

		return true;
	},
	shutdown: function (only_for_key) {
		if (!only_for_key) {
			mage.core.logger.debug('SchedulerServer: Clearing local state...');
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
	reloadFromStore: function (state, cb) {
		mage.core.logger.debug('SchedulerServer: Reloading state from store...');

		// wipe out everything
		this.shutdown();

		var that = this,
			store = state.datasources.kv;

		var error = function (err) {
			that.shutdown();
			state.error(null, 'SchedulerServer: Got an error while reloading state from store ー ' + err, cb);
		};

		// Read the master list
		store.getOne(this.masterKey, false, null, function (err, schedules) {
			if (err) {
				return error(err);
			}

			// Instantiate the schedules
			var scheduleKeys = [];
			for (var schedule in schedules) {
				scheduleKeys.push(schedule);
				if (!that.createSchedule(schedule, schedules[schedule].spec)) {
					return error("Invalid schedule '" + JSON.stringify(schedules[schedule].spec) + "'");
				}
			}

			// Nothing left to do?
			if (scheduleKeys.length === 0) {
				return cb();
			}

			store.getMany(scheduleKeys, false, null, function (err, taskIndex) {
				if (err) {
					return error(err);
				}

				// Get all the tasks' keys
				var allTaskKeys = [];
				for (var scheduleKey in schedules) {
					that.tasks_for_schedule[scheduleKey] = [];
					allTaskKeys = allTaskKeys.concat(taskIndex[scheduleKey] || []);
				}

				// Nothing left to do?
				if (allTaskKeys.length === 0) {
					return cb();
				}

				// Load all tasks
				store.getMany(allTaskKeys, false, null, function (err, allTasks) {
					if (err) {
						return error(err);
					}

					// Instantiate the tasks
					for (var taskKey in allTasks) {
						var task = allTasks[taskKey];
						that.tasks[taskKey] = task;
						that.tasks_for_schedule[task.schedule].push(taskKey);
					}

					return cb();
				});
			});
		});
	},
	nukeStore: function (state, cb) {
		var that = this;

		this.reloadFromStore(state, function () {
			var store = state.datasources.kv;

			for (var taskKey in that.tasks) {
				store.del(taskKey);
			}

			for (var scheduleKey in that.schedules) {
				store.del(scheduleKey);
			}

			store.del(that.masterKey);

			that.shutdown();
			cb();
		});
	},
	scheduleCommand: function (state, client, taskName, scheduleInfo, data, cb) {
		var scheduleKey = this.keyFromScheduleInfo(scheduleInfo),
			taskKey = this.keyFromTaskName(client, taskName),
			kv = state.datasources.kv,
			masterListDirty;

		// Unschedule task if it exists already
		var oldScheduleKey = this.deleteTask(taskKey);
		if (oldScheduleKey && (oldScheduleKey !== scheduleKey)) {
			var list = this.tasks_for_schedule[oldScheduleKey];
			if (list && list.length) {
				kv.set(oldScheduleKey, list, this.ttl);
			} else {
				// old schedule has been deleted
				kv.del(oldScheduleKey);
				masterListDirty = true;
			}
		}


		// Create the new schedule if it doesn't exist yet
		if (!this.schedules[scheduleKey]) {
			if (!this.createSchedule(scheduleKey, scheduleInfo)) {
				return cb("Invalid schedule " + JSON.stringify(scheduleInfo));
			}
			masterListDirty = true;
		}

		// Schedule it
		var task = {
			schedule: scheduleKey,
			client: client,
			taskName: taskName,
			data: data
		};

		if (!this.addTask(taskKey, task)) {
			return cb("Can't add task " + JSON.stringify(task));
		}

		// Persist task
		kv.set(taskKey, task, this.ttl);
		kv.set(scheduleKey, this.tasks_for_schedule[scheduleKey], this.ttl);
		if (masterListDirty) {
			kv.set(this.masterKey, this.infos, this.ttl);
		}

		return cb();
	}
};
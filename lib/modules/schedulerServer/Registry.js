/** @module Registry */
var crypto = require('crypto');
var mithril = require(__dirname + '/../../mithril');
var scheduler = require('../scheduler');
var Schedule = scheduler.Schedule;
var CommandCenterClient = require('../scheduler/CommandCenterClient');


/**
 * Helper function for generating sorted JSON.
 * 
 * @param {Object} obj
 * @return {String}
 */

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


/**
 * Uses sorted JSON to create a reliable hash from data. Takes any number of arbitrary arguments.
 *
 * @return {String}
 */

var stableHash = function () {
	var h = crypto.createHmac('sha1', '');

	for (var i in arguments) {
		if (arguments.hasOwnProperty(i)) {
			h.update(sortedJSON(arguments[i]));
		}
	}
	// return the digest as unpadded base64
	return new Buffer(h.digest('binary'))
		.toString('base64')
		.replace(/\=+$/g, '');
};


/**
 * The registry constructor.
 * 
 * @param {Object} options
 * @alias module:Registry
 * @constructor
 */
	
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
	this.tasksForSchedule = {};

	// schedule key > schedule info string mapping
	this.infos = {};

	// task key > command center client mapping
	this.peers = {};
};


/**
 * TODO What does this do?
 *
 * @param scheduleInfo // TODO What type is this?
 * @return {String}
 */

Registry.prototype.keyFromScheduleInfo = function (scheduleInfo) {
	return this.scheduleKeysPrefix + stableHash(scheduleInfo);
};


/**
 * TODO What does this do?
 *
 * @param client // TODO What type is this?
 * @param taskName // TODO What type is this?
 * @return {String}
 */

Registry.prototype.keyFromTaskName = function (client, taskName) {
	return this.taskKeysPrefix + stableHash(client, taskName);
};


/**
 * Invoke a tasks associated with key.
 *
 * @param {String} key
 */

Registry.prototype.invokeTasks = function (key) {
	mithril.core.logger.debug('SchedulerServer: Invoking tasks for schedule ' + String(this.infos[key].spec));

	var taskKeys = this.tasksForSchedule[key] || [];
	for (var taskKey in taskKeys) {
		if (taskKeys.hasOwnProperty(taskKey)) {
			taskKey = taskKeys[taskKey];
			var task = this.tasks[taskKey];
			
			if (!task) {
				mithril.core.logger.debug("SchedulerServer: Can't find task for key " + JSON.stringify(taskKey));
				continue;
			}
			
			mithril.core.logger.debug('SchedulerServer: Task key = ' + JSON.stringify(taskKey));

			if (!this.peers[taskKey]) {
				this.peers[taskKey] = new CommandCenterClient(task.client);
			}

			var params = {
				appName: task.client.app,
				taskName: task.taskName,
				data: task.data
			};

			mithril.core.logger.info('Invoking task "' + task.taskName + '" on app "' + task.client.app + '" at ' + task.client.host + ':' + task.client.port);
			this.peers[taskKey].send('scheduler.runTask', params);
		}
	}
};


/**
 * Delete a task associated with key.
 *
 * @param {String} key
 * @param {Boolean} doNotCancelEmptySchedules
 * @return {*} // TODO Check type.
 */

Registry.prototype.deleteTask = function (key, doNotCancelEmptySchedules) {
	var task = this.tasks[key];
	
	if (!task) {
		return;
	}
	
	mithril.core.logger.debug('SchedulerServer: Deleting task ' + task.taskName + ' of app ' + task.client.app);

	var schedule = task.schedule;
	
	// Unschedule it.
	if (this.tasksForSchedule[schedule]) {
		var index = this.tasksForSchedule[schedule].indexOf(key);
		
		if (index !== -1) {
			this.tasksForSchedule[schedule].splice(index, 1);
			
			if (this.tasksForSchedule[schedule].length === 0) {
				mithril.core.logger.debug('SchedulerServer: Schedule ' + this.infos[schedule].spec + ' is empty.');
				
				if (!doNotCancelEmptySchedules) {
					this.shutdown(schedule);
				}
			}
		}
	}

	// Delete it
	delete this.tasks[key];
	delete this.peers[key];

	return schedule;
};


/**
 * Add a task to associate with key.
 *
 * @param {String} key
 * @param {Object} task
 * @return {Boolean}
 */

Registry.prototype.addTask = function (key, task) {
	if (this.tasks[key]) {
		return false;
	}

	if (!this.tasksForSchedule[task.schedule]) {
		return false;
	}

	this.tasks[key] = task;
	this.tasksForSchedule[task.schedule].push(key);
	return true;
};


/**
 * Create a schedule for key, optionally overwriting an existing one.
 *
 * @param {String} key
 * @param {Object|string} info An object, or sorted JSON string.
 * @param deleteExisting Allow overwriting?
 * @return {Boolean} Does the schedule now exist?
 */

Registry.prototype.createSchedule = function (key, info, deleteExisting) {
	if (this.infos[key] && !deleteExisting) {
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
	this.tasksForSchedule[key] = [];
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
};


/**
 * Cleanup the schedule. // TODO What is onlyForKey for?
 *
 * @param onlyForKey
 */

Registry.prototype.shutdown = function (onlyForKey) {
	if (!onlyForKey) {
		mithril.core.logger.debug('SchedulerServer: Clearing local state...');
	}

	for (var key in this.schedules) {
		if (this.schedules.hasOwnProperty(key)) {
			if (onlyForKey && (key !== onlyForKey)) {
				continue;
			}

			// Cancel the schedule
			if (this.schedules[key] instanceof Schedule) {
				this.schedules[key].removeAllListeners();
				this.schedules[key].cancel();
			}

			// Wipe out dependent tasks
			this.tasksForSchedule[key] = this.tasksForSchedule[key] || [];
			
			for (var taskKey in this.tasksForSchedule[key]) {
				if (this.tasksForSchedule[key].hasOwnProperty(taskKey)) {
					taskKey = this.tasksForSchedule[key][taskKey];
					delete this.tasks[taskKey];
				}
			}
			
			delete this.tasksForSchedule[key];

			// Delete old stuff
			delete this.infos[key];
			delete this.schedules[key];
		}
	}
};


/**
 * Reload the registry state from the datastore.
 *
 * @param {Object} state
 * @param {Function} cb
 */

Registry.prototype.reloadFromStore = function (state, cb) {
	mithril.core.logger.debug('SchedulerServer: Reloading state from store...');

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
			if (schedules.hasOwnProperty(schedule)) {
				scheduleKeys.push(schedule);
				if (!that.createSchedule(schedule, schedules[schedule].spec)) {
					return error("Invalid schedule '" + JSON.stringify(schedules[schedule].spec) + "'");
				}
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
				if (schedules.hasOwnProperty(scheduleKey)) {
					that.tasksForSchedule[scheduleKey] = [];
					allTaskKeys = allTaskKeys.concat(taskIndex[scheduleKey] || []);
				}
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
					if (allTasks.hasOwnProperty(taskKey)) {
						var task = allTasks[taskKey];
						that.tasks[taskKey] = task;
						that.tasksForSchedule[task.schedule].push(taskKey);	
					}
				}

				return cb();
			});
		});
	});
};


/**
 * Remove state from the datastore.
 *
 * @param {Object} state
 * @param {Function} cb
 */

Registry.prototype.nukeStore = function (state, cb) {
	var that = this;

	this.reloadFromStore(state, function () {
		var store = state.datasources.kv;

		for (var taskKey in that.tasks) {
			if (that.tasks.hasOwnProperty(taskKey)) {
				store.del(taskKey);
			}
		}

		for (var scheduleKey in that.schedules) {
			if (that.schedules.hasOwnProperty(scheduleKey)) {
				store.del(scheduleKey);
			}
		}

		store.del(that.masterKey);

		that.shutdown();
		cb();
	});
};


/**
 * Schedule a task.
 *
 * @param {Object} state
 * @param {} client // TODO What type?
 * @param {String} taskName
 * @param {} scheduleInfo // TODO What type?
 * @param {} data // TODO What type?
 * @param {Function} cb
 */

Registry.prototype.scheduleCommand = function (state, client, taskName, scheduleInfo, data, cb) {
	var scheduleKey = this.keyFromScheduleInfo(scheduleInfo),
		taskKey = this.keyFromTaskName(client, taskName),
		kv = state.datasources.kv,
		masterListDirty;

	// Unschedule task if it exists already
	var oldScheduleKey = this.deleteTask(taskKey);
	if (oldScheduleKey && (oldScheduleKey !== scheduleKey)) {
		var list = this.tasksForSchedule[oldScheduleKey];
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
	kv.set(scheduleKey, this.tasksForSchedule[scheduleKey], this.ttl);
	if (masterListDirty) {
		kv.set(this.masterKey, this.infos, this.ttl);
	}

	return cb();
};

// Expose the Registry constructor.
module.exports = Registry;
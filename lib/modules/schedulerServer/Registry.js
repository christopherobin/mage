/** @module Registry */
var crypto = require('crypto');
var mage = require('../../mage');
var rumplestiltskin = require('rumplestiltskin');
var scheduler = require('../scheduler');
var Schedule = scheduler.Schedule;
var CommandCenterClient = require('../scheduler/CommandCenterClient');

var logger = mage.core.logger.context('schedulerServer');

/**
 * Uses sorted JSON to create a reliable hash from data. Takes any number of arbitrary arguments.
 * Internally this now uses rumplestiltskin for stable hash of each argument. A hash is distilled to
 * an md5 hex string to maintain reasonable size.
 *
 * @return {String}
 * @private
 */

function stableHash() {
	var h = crypto.createHash('md5');

	for (var i = 0; i < arguments.length; i++) {
		h.update(rumplestiltskin.trueName(arguments[i]));
	}

	// Return the digest a hex string.
	return h.digest('hex');
}


/**
 * Uses a hash composed of the schedule info to construct a key.
 *
 * @param {Object} registry     An instance of Registry.
 * @param {Object} scheduleInfo
 * @return {String}
 */

function keyFromScheduleInfo(registry, scheduleInfo) {
	return registry.scheduleKeysPrefix + stableHash(scheduleInfo);
}


/**
 * Constuct a key using the client and task names.
 *
 * @param  {Object} registry An instance of Registry.
 * @param           client   // TODO What type is this?
 * @param           taskName // TODO What type is this?
 * @return {String}
 */

function keyFromTaskName(registry, client, taskName) {
	return registry.taskKeysPrefix + stableHash(client, taskName);
}


/**
 * Invoke a tasks associated with key.
 *
 * @param {Object} registry An instance of Registry.
 * @param {String} key
 */

function invokeTasks(registry, key) {
	logger.debug('Invoking tasks for schedule', registry.infos[key].spec);

	var taskKeys = registry.tasksForSchedule[key] || [];
	for (var taskKey in taskKeys) {
		if (taskKeys.hasOwnProperty(taskKey)) {
			taskKey = taskKeys[taskKey];
			var task = registry.tasks[taskKey];

			if (!task) {
				logger.debug('Can\'t find task for key', taskKey);
				continue;
			}

			logger.debug('Task key', taskKey);

			if (!registry.peers[taskKey]) {
				registry.peers[taskKey] = new CommandCenterClient(task.client);
			}

			var params = {
				appName: task.client.app,
				taskName: task.taskName,
				data: task.data
			};

			logger.info('Invoking task', task.taskName, 'on app', task.client.app, 'at', task.client.host + ':' + task.client.port);
			registry.peers[taskKey].send('scheduler.runTask', params);
		}
	}
}


/**
 * Delete a task associated with key.
 *
 * @param  {Object}  registry An instance of Registry.
 * @param  {String}  key
 * @param  {Boolean} doNotCancelEmptySchedules
 * @return {*}       // TODO Check type.
 */

function deleteTask(registry, key, doNotCancelEmptySchedules) {
	var task = registry.tasks[key];

	if (!task) {
		return;
	}

	logger.debug('Deleting task', task.taskName, 'of app', task.client.app);

	var schedule = task.schedule;

	// Unschedule it.
	if (registry.tasksForSchedule[schedule]) {
		var index = registry.tasksForSchedule[schedule].indexOf(key);

		if (index !== -1) {
			registry.tasksForSchedule[schedule].splice(index, 1);

			if (registry.tasksForSchedule[schedule].length === 0) {
				logger.debug('Schedule', registry.infos[schedule].spec, 'is empty.');

				if (!doNotCancelEmptySchedules) {
					registry.shutdown(schedule);
				}
			}
		}
	}

	// Delete it
	delete registry.tasks[key];
	delete registry.peers[key];

	return schedule;
}


/**
 * Add a task to associate with key.
 *
 * @param  {Object}  registry An instance of Registry.
 * @param  {String}  key
 * @param  {Object}  task
 * @return {Boolean} Returns true if the task was successfully added.
 */

function addTask(registry, key, task) {
	if (registry.tasks[key] || !registry.tasksForSchedule[task.schedule]) {
		return false;
	}

	registry.tasks[key] = task;
	registry.tasksForSchedule[task.schedule].push(key);
	return true;
}


/**
 * Create a schedule for key, optionally overwriting an existing one.
 *
 * @param  {Object}        registry       An instance of Registry.
 * @param  {String}        key            A key to associate with this schedule.
 * @param  {Object|String} details        An object, or sorted JSON string.
 * @param  {Boolean}       deleteExisting Allow overwriting?
 * @return {Boolean}                      Does the schedule now exist?
 */

function createSchedule(registry, key, details, deleteExisting) {
	if (registry.infos[key] && !deleteExisting) {
		return true;
	}

	var info = (typeof details === 'object') ? JSON.stringify(details) : details;

	// Delete old schedule
	registry.shutdown(key);

	// Create new one
	var schedule = scheduler.parseSchedule(info);

	if (!schedule || schedule.isInvalid()) {
		logger.error('Invalid schedule spec:', info);
		return false;
	}

	registry.schedules[key] = schedule;
	registry.tasksForSchedule[key] = [];
	registry.infos[key] = {
		spec: info
	};

	// This info is only ever used by the tool
	if (schedule instanceof scheduler.Cron) {
		registry.infos[key].type = 'Cron';
	} else if (schedule instanceof scheduler.HeartBeat) {
		registry.infos[key].type = 'HeartBeat';
	}

	registry.schedules[key].on('run', function (date) {
		invokeTasks(registry, key, date);
	});

	registry.schedules[key].on('end', function () {
		logger.debug('Schedule', info, 'just ended.');
		registry.shutdown(key);
	});

	registry.schedules[key].on('cancel', function () {
		logger.debug('Schedule', info, 'was canceled.');
		// schedules only get canceled by the shutdown() method
	});

	logger.debug('Created schedule', info);
	registry.schedules[key].run();

	return true;
}


/**
 * The registry constructor.
 *
 * @param {Object} options
 * @alias module:Registry
 * @constructor
 */

function Registry(prefix, ttl) {
	// config
	this.prefix = prefix || '';
	this.ttl = ttl || 0;

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
}


/**
 * Cleanup the schedule. If onlyForKey is provided, this schedule alone is cleaned up.
 *
 * @param {String} [onlyForKey]
 */

Registry.prototype.shutdown = function (onlyForKey) {
	var that = this;

	function clearForKey(key) {
		if (that.schedules[key] instanceof Schedule) {
			that.schedules[key].removeAllListeners();
			that.schedules[key].cancel();
		}

		// Wipe out dependent tasks
		that.tasksForSchedule[key] = that.tasksForSchedule[key] || [];

		var taskKeys = Object.keys(that.tasksForSchedule[key] || {});

		for (var j = 0; j < taskKeys.length; j++) {
			var taskKey = that.tasksForSchedule[key][taskKeys[j]];
			delete that.tasks[taskKey];
		}

		delete that.tasksForSchedule[key];

		// Delete old stuff
		delete that.infos[key];
		delete that.schedules[key];
	}

	if (onlyForKey) {
		return clearForKey(onlyForKey);
	}

	logger.debug('Clearing local state...');
	return Object.keys(this.schedules || {}).forEach(clearForKey);
};


/**
 * Reload the registry state from the datastore.
 *
 * @param {Object} state
 * @param {Function} cb
 */

Registry.prototype.reloadFromStore = function (state, cb) {
	logger.debug('SchedulerServer: Reloading state from store...');

	// wipe out everything
	this.shutdown();

	var that = this;
	var kv = state.datasources.kv;

	function errorHandler() {
		that.shutdown();
		cb();
	}

	// Read the master list
	kv.getOne(this.masterKey, false, null, function (err, schedules) {
		if (err) {
			return errorHandler();
		}

		// Instantiate the schedules
		var scheduleKeys = Object.keys(schedules || {});

		// Nothing left to do?
		if (scheduleKeys.length === 0) {
			return cb();
		}

		for (var i = 0; i < scheduleKeys.length; i++) {
			var key = scheduleKeys[i];

			if (!createSchedule(that, key, schedules[key].spec)) {
				logger.error('Invalid schedule', schedules[key].spec);
				return errorHandler();
			}
		}

		kv.getMany(scheduleKeys, false, null, function (err, taskIndex) {
			if (err) {
				return errorHandler();
			}

			// Get all the tasks' keys
			var allTaskKeys = [];

			for (var i = 0; i < scheduleKeys.length; i++) {
				var scheduleKey = scheduleKeys[i];

				that.tasksForSchedule[scheduleKey] = [];
				allTaskKeys = allTaskKeys.concat(taskIndex[scheduleKey] || []);
			}

			// Nothing left to do?
			if (allTaskKeys.length === 0) {
				return cb();
			}

			// Load all tasks
			kv.getMany(allTaskKeys, false, null, function (err, allTasks) {
				if (err) {
					return errorHandler();
				}

				// Instantiate the tasks
				var taskKeys = Object.keys(allTasks || {});

				for (var i = 0; i < taskKeys.length; i++) {
					var taskKey = taskKeys[i];
					var task = allTasks[taskKey];

					that.tasks[taskKey] = task;
					that.tasksForSchedule[task.schedule].push(taskKey);
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
		var kv = state.datasources.kv;

		var taskKeys = Object.keys(that.tasks || {});

		for (var i = 0; i < taskKeys.length; i++) {
			kv.del(taskKeys[i]);
		}

		var scheduleKeys = Object.keys(that.schedules || {});

		for (var j = 0; j < scheduleKeys.length; j++) {
			kv.del(scheduleKeys[j]);
		}

		kv.del(that.masterKey);

		that.shutdown();
		cb();
	});
};


/**
 * Schedule a task.
 *
 * @param {Object}        state
 * @param {}              client // TODO What type?
 * @param {String}        taskName
 * @param {Object|String} scheduleInfo
 * @param {Object}        data
 * @param {Function}      cb           Callback function may take an error as an argument.
 */

Registry.prototype.scheduleCommand = function (state, client, taskName, scheduleInfo, data, cb) {
	var scheduleKey = keyFromScheduleInfo(this, scheduleInfo);
	var taskKey = keyFromTaskName(this, client, taskName);
	var kv = state.datasources.kv;
	var masterListDirty;

	// Unschedule task if it exists already
	var oldScheduleKey = deleteTask(this, taskKey);
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
		if (!createSchedule(this, scheduleKey, scheduleInfo)) {
			return cb(new Error('Invalid schedule ' + JSON.stringify(scheduleInfo)));
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

	if (!addTask(this, taskKey, task)) {
		var message = 'Can\'t add task ' + JSON.stringify(task);
		logger.error(message);
		return cb(new Error(message));
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
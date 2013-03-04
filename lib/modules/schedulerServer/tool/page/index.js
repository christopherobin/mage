$html5client('module.schedulerServer');

(function (window) {
	var mage = window.mage;
	var schedulerServer = mage.schedulerServer;

	// functions to enable/disable UI
	// Supports multiple overlays at once!
	var Dimmer = function Dimmer(selector) {
		this.selector = selector;
		this.count = 0;
	};

	Dimmer.prototype.dim = function () {
		if (this.count === 0) {
			Array.prototype.forEach.call(document.querySelectorAll(this.selector), function (element) {
				element.classList.add('dimmed');
			});
		}

		this.count += 1;
	};

	Dimmer.prototype.undim = function () {
		this.count -= 1;

		if (this.count === 0) {
			Array.prototype.forEach.call(document.querySelectorAll(this.selector), function (element) {
				element.classList.remove('dimmed');
			});
		}
	};

	Dimmer.prototype.async = function (fn) {
		var that = this;
		that.dim();

		return function () {
			if (typeof fn === 'function') {
				fn.apply(null, arguments);
			}

			that.undim();
		};
	};

	// Functions to log stuff to my console.
	// (Actually supports multiple consoles, using 'target' below!)
	var Logger = function Logger(selector) {
		this.selector = selector;
	};

	Logger.prototype.log = function (cat, message, target) {
		var now = new Date();

		var pad2 = function (x) {
			x = String(x);
			return '00'.slice(x.length) + x;
		};

		now = String(now.getFullYear()).concat(
			'-',
			pad2(now.getMonth() + 1),
			'-',
			pad2(now.getDate()),
			' ',
			pad2(now.getHours()),
			': ',
			pad2(now.getMinutes()),
			': ',
			pad2(now.getSeconds())
		);

		Array.prototype.forEach.call(document.querySelectorAll(this.selector), function (element) {
			if (Object.prototype.toString.call(target) === '[object String]' && !element.classList.contains(target)) {
				return undefined;
			}

			var line = document.createElement('div');
			var date = line.appendChild(document.createElement('span'));
			var content = line.appendChild(document.createElement('span'));

			line.classList.add(cat);
			date.textContent = now;
			content.textContent = message;

			element.appendChild(line);
			element.scrollTop = element.scrollHeight - element.clientHeight;
		});
	};

	Logger.prototype.info = function (message, target) {
		this.log('info', message, target);
	};

	Logger.prototype.warn = function (message, target) {
		this.log('warn', message, target);
	};

	Logger.prototype.error = function (message, target) {
		this.log('error', message, target);
	};

	// Functions for emoji
	var iCanHazEmoji = (function () {
		try {
			var canvas = document.createElement('canvas');
			canvas.width = canvas.height = 10;
			var context = canvas.getContext("2d");
			context.font = '48px sans-serif';
			context.fillText("\ud83d\ude03", 0, 10);
			var data = context.getImageData(0, 0, 10, 10).data;
			var len = parseInt(data.length, 10) || 0;

			while (len > 0) {
				if (data[--len]) {
					return true;
				}
			}

		} catch (ignored) { }
		return false;
	} ());

	var emoji = function (em, repl) {
		return iCanHazEmoji ? em : (repl || '');
	};

	var scheduleTypes = {
		Cron: emoji('\uD83D\uDD53', '⌚') + '\u2003Cron',
		HeartBeat: emoji('\uD83D\uDC93', '♥') + '\u2003HeartBeat'
	};

	var SchedulerServerAdminPage = function SchedulerServerAdminPage() {
		var self = this;

		this.dimmer = new Dimmer('#schedulerServerTool .working');
		this.logger = new Logger('#schedulerServerTool .console');

		schedulerServer.on('display', function () {
			self.init();
		});
	};

	SchedulerServerAdminPage.prototype.init = function () {
		this.ui = {
			admin: document.getElementById('schedulerServerToolAdmin'),
			schedules: document.getElementById('schedulerServerToolSchedules'),
			scheduleInfo: {
				table: document.getElementById('schedulerServerToolScheduleInfoTable'),
				events: document.getElementById('schedulerServerToolScheduleInfoEvents'),
				tasks: document.getElementById('schedulerServerToolScheduleInfoTasks')
			}
		};

		this.currentScheduleKey = null;
		this.dimmer.dim();
		this.setupAdminLinks();
		this.refresh();
		this.dimmer.undim();
	};

	SchedulerServerAdminPage.prototype.setupAdminLinks = function () {
		var links = {};
		links[emoji("\uD83D\uDD04", '♻') + "\u2003Refresh schedules list"] = this.refresh.bind(this);
		links[emoji("\uD83D\uDCBE", '♻') + "\u2003Reload from DB"] = this.reloadFromDB.bind(this);
		links[emoji("\uD83D\uDCA2", '⚠') + "\u2003Wipe out memory"] = this.wipeOutMemory.bind(this);
		links[emoji("\uD83D\uDC80", '☠') + "\u2003Wipe out memory & DB"] = this.nuke.bind(this);

		this.ui.admin.textContent = '';

		for (var link in links) {
			if (links.hasOwnProperty(link)) {
				var button = this.ui.admin.appendChild(document.createElement('li')).appendChild(document.createElement('button'));
				button.type = 'button';
				button.textContent = link;
				button.addEventListener('click', links[link], false);
			}
		}
	};

	SchedulerServerAdminPage.prototype.selectSchedule = function (scheduleKey) {
		var self = this;

		this.ui.scheduleInfo.table.textContent = '';
		this.ui.scheduleInfo.events.textContent = '';
		this.ui.scheduleInfo.tasks.textContent = '';

		if (!scheduleKey) {
			return undefined;
		}

		schedulerServer.getScheduleInfo(scheduleKey, self.dimmer.async(function (error, result) {
			if (error) {
				return self.logger.error(error);
			}

			if (!result.key) {
				return self.logger.error("Invalid schedule encountered: " + JSON.stringify(result));
			}

			if (!result.info ||	!result.info.spec || !result.info.type) {
				return self.logger.error("Invalid schedule encountered: " + JSON.stringify(result));
			}

			if (!scheduleTypes[result.info.type]) {
				return self.logger.error("Invalid schedule encountered: " + JSON.stringify(result));
			}

			if (!Array.isArray(result.nextEvents) || !Array.isArray(result.tasks)) {
				return self.logger.error("Invalid schedule encountered: " + JSON.stringify(result));
			}

			if (result.info.type === 'HeartBeat') {
				var valid;

				try {
					valid = result.info.spec = JSON.parse(result.info.spec);
				} catch (e) {}

				if (!valid || !result.info.spec.period) {
					return self.logger.error("Invalid schedule encountered: " + JSON.stringify(result));
				}
			}

			self.logger.info('Retrieved info for key "' + result.key + '"');
			self.currentScheduleKey = result.key;

			var tableFragment = document.createDocumentFragment();
			var eventsFragment = document.createDocumentFragment();
			var tasksFragment = document.createDocumentFragment();


			var rows = [
				["Key", result.key],
				["Type", scheduleTypes[result.info.type]]
			];

			switch (result.info.type) {
			case 'Cron':
				rows.push(["Crontab", result.info.spec]);
				break;
			case 'HeartBeat':
				rows.push(["Period", result.info.spec.period]);
				if (result.info.spec.start) {
					rows.push(["Start on", result.info.spec.start]);
				}
				if (result.info.spec.end) {
					rows.push(["Ends on", result.info.spec.end]);
				}
				break;
			}

			var numberOfRows = rows.length >>> 0;
			for (var i = 0; i < numberOfRows; i++) {
				var row = tableFragment.appendChild(document.createElement('tr'));
				var title = row.appendChild(document.createElement('td'));
				var content = row.appendChild(document.createElement('td'));

				title.textContent = rows[i][0];
				content.textContent = rows[i][1];
			}

			var clientsListElement = tasksFragment.appendChild(document.createElement('ul'));
			var sortedTasks = {};

			result.tasks.forEach(function (task) {
				var clientDesc = task.client.host + ':' + task.client.port + '/' + task.client.app;

				sortedTasks[clientDesc] = sortedTasks[clientDesc] || {};
				sortedTasks[clientDesc][task.name] = {
					key: task.key,
					data: task.data
				};
			});

			Object.keys(sortedTasks).sort().forEach(function (client) {
				var clientid = encodeURIComponent(client).replace(/[\.%]/g, '_');
				var li = clientsListElement.appendChild(document.createElement('li'));
				var checkbox = li.appendChild(document.createElement('input'));
				var label = li.appendChild(document.createElement('label'));
				var tasksListElement = li.appendChild(document.createElement('ul'));

				checkbox.type = 'checkbox';
				checkbox.id = 'fold-' + clientid;
				label.setAttribute('for', checkbox.id);
				label.textContent = client;

				Object.keys(sortedTasks[client]).sort().forEach(function (taskName) {
					var task = sortedTasks[client][taskName];
					var taskElement = tasksListElement.appendChild(document.createElement('li'));

					taskElement.textContent = 'Name: ' + taskName + ', key: ' + task.key + ', data: ' + JSON.stringify(task.data);
				});
			});

			self.ui.scheduleInfo.table.appendChild(tableFragment);
			self.ui.scheduleInfo.events.appendChild(eventsFragment);
			self.ui.scheduleInfo.tasks.appendChild(tasksFragment);
		}));
	};

	SchedulerServerAdminPage.prototype.refresh = function () {
		var self = this;

		var clickHandler = function () {
			self.selectSchedule(this.dataset.scheduleKey);
		};

		schedulerServer.listSchedules(self.dimmer.async(function (error, result) {
			if (error) {
				self.logger.error(error);
				return;
			}

			self.logger.info("Schedules list retrieved successfully");
			self.ui.schedules.textContent = '';

			var hasOldScheduleKey;

			for (var scheduleKey in result) {
				if (result.hasOwnProperty(scheduleKey)) {
					var info = result[scheduleKey];
					var label;

					switch (info.type) {
					case 'Cron':
						label = scheduleTypes.Cron + "('" + info.spec + "')";
						break;

					case 'HeartBeat':
						try {
							info.spec = JSON.parse(info.spec);
						} catch (e) {
							self.logger.warn('Ignoring invalid schedule ' + scheduleKey + ' (info: ' + JSON.stringify(info) + ')');
							continue;
						}
						var args = ["'" + info.spec.period + "'"];
						if (info.spec.end) {
							args.push("null");
							args.push("'" + info.spec.end + "'");
						}
						if (info.spec.start) {
							args[1] = "'" + info.spec.start + "'";
						}
						label = scheduleTypes.HeartBeat + "(" + args.join(', ') + ")";
						break;

					default:
						self.logger.warn('Ignoring invalid schedule ' + scheduleKey + ' (info: ' + JSON.stringify(info) + ')');
						continue;
					}
					hasOldScheduleKey = hasOldScheduleKey || (self.currentScheduleKey === scheduleKey);

					var li = self.ui.schedules.appendChild(document.createElement('li'));
					var button = li.appendChild(document.createElement('button'));

					button.type = 'button';
					button.textContent = label;
					button.dataset.scheduleKey = scheduleKey;
					button.addEventListener('click', clickHandler, false);
				}
			}

			if (!hasOldScheduleKey) {
				// Old schedule wasn't found, so delete its info
				self.ui.scheduleInfo.table.textContent = '';
				self.ui.scheduleInfo.events.textContent = '';
				self.ui.scheduleInfo.tasks.textContent = '';
			}

		}));
	};

	SchedulerServerAdminPage.prototype.reloadFromDB = function () {
		var self = this;

		schedulerServer.reload(self.dimmer.async(function (error) {
			if (error) {
				self.logger.error(error);
			} else {
				self.logger.info("Reloaded database");
				self.refresh();
			}
		}));
	};

	SchedulerServerAdminPage.prototype.wipeOutMemory = function () {
		var self = this;

		if (confirm("This will make Shokoti forget about everything currently scheduled.\nYou can make her remember later by clicking the \"Reload from DB\" button.\n\nContinue?")) {
			schedulerServer.shutdown(self.dimmer.async(function (error) {
				if (error) {
					self.logger.error(error);
				} else {
					self.logger.info("Cleared Shokoti's memory");
					self.refresh();
				}
			}));
		}
	};

	SchedulerServerAdminPage.prototype.nuke = function () {
		var self = this;

		if (confirm("STOP RIGHT THERE!\n\nYou're about to completely reset Shokoti. This can't be undone!\n\nARE YOU SURE YOU WANT TO PROCEED?")) {
			schedulerServer.nuke(self.dimmer.async(function (error) {
				if (error) {
					self.logger.error(error);
				} else {
					self.logger.info("Shokoti has been reset");
					self.refresh();
				}
			}));
		}
	};


	schedulerServer.onceSetup(function () {
		if (!schedulerServer.adminPage) {
			schedulerServer.adminPage = new SchedulerServerAdminPage();
		}
	});
}(window));

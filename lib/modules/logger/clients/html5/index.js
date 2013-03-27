(function (window) {

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.logger.construct'));

	var console = window.console;

	var errorBackup = console.error;

	var logLevels = {};

	function serializeArguments(args) {
		var len = args.length;
		var out = new Array(len);
		var data = null;

		for (var i = 0; i < len; i++) {
			var arg = args[i];

			if (arg instanceof Error) {
				data = {
					name: arg.name,
					stack: arg.stack,
					message: arg.message
				};

				arg = 'Error (see data)';
			} else if (arg instanceof window.ErrorEvent) {
				// arg is of type ErrorEvent, which has "filename", "lineno" and "message"

				data = {
					name: 'ErrorEvent',
					filename: arg.filename,
					line: arg.lineno,
					message: arg.message
				};

				arg = 'HTML5 client ErrorEvent: ' + arg.message;
			}

			if (arg === undefined) {
				out[i] = 'undefined';
			} else if (typeof arg === 'string') {
				out[i] = arg;
			} else {
				try {
					out[i] = JSON.stringify(arg);  // may fail because of circular references
				} catch (e) {
					out[i] = '<error-while-stringifying-argument>';
				}
			}
		}

		var message = out.join(' ');

		return { message: message, data: data };
	}


	function setChannelFunction(channelName) {
		if (mod[channelName]) {
			// already set
			return;
		}

		mod[channelName] = function () {
			mod.emit(channelName, arguments);
		};
	}


	// Writer classes
	// --------------

	// Console

	function ConsoleWriter() {
	}


	ConsoleWriter.prototype.addChannel = function (channelName) {
		var slice = Array.prototype.slice;
		var prefix = ['[' + channelName + ']'];
		var logLevel = logLevels[channelName] || 0;
		var fn;

		if (logLevel > logLevels.warning) {
			fn = console.error;
		} else if (logLevel >= logLevels.notice) {
			fn = console.warn;
		} else {
			fn = console.log;
		}

		mod.on(channelName, function (args) {
			args = prefix.concat(slice.call(args));

			fn.apply(console, args);
		});
	};


	// Server

	function ServerWriter() {
	}


	function backupError() {
		errorBackup.apply(console, arguments);
	}

	ServerWriter.prototype.addChannel = function (channelName) {
		mod.on(channelName, function (args) {
			if (!mod.sendReport) {
				backupError('Cannot log to server, please expose the "sendReport" user command', channelName, args);
				return;
			}

			var report = serializeArguments(args);

			mage.io.queue(function () {
				mod.sendReport('html5', channelName, report.message, report.data, function (error) {
					if (error) {
						backupError('Could not forward logs to remote server');
					}
				});
			});
		});
	};


	var writerClasses = {
		console: ConsoleWriter,
		server: ServerWriter
	};


	var writers = {};

	function getOrCreateWriter(writerType) {
		var writer = writers[writerType];

		if (writer) {
			return writer;
		}

		var WriterClass = writerClasses[writerType];

		if (!WriterClass) {
			console.error('Unknown writer type: ' + writerType);
			return;
		}

		writer = new WriterClass();

		writers[writerType] = writer;

		return writer;
	}


	function setupChannels(config) {
		var allChannelNames = Object.keys(logLevels);

		for (var i = 0, len = allChannelNames.length; i < len; i++) {
			var channelName = allChannelNames[i];

			// make sure events are emitted for this channel

			setChannelFunction(channelName);

			// if there are any writers that care about this channel, make them listen for it

			for (var writerType in config) {
				var writerChannels = config[writerType];
				var writer = getOrCreateWriter(writerType);

				if (writer && writerChannels.indexOf(channelName) !== -1) {
					writer.addChannel(channelName);
				}
			}
		}
	}


	mod.setup = function (cb) {
		if (!mod.hasOwnProperty('sync')) {
			return cb('Could not sync: logger.sync is not exposed.');
		}

		mod.sync(function (error, data) {
			if (error) {
				return cb(error);
			}

			logLevels = data.logLevels;

			setupChannels(data.config);

			if (!data.disableOverride) {
				mod.overrideConsole();
			}

			cb();
		});
	};


	mod.overrideConsole = function () {
		console.log = function () {
			mod.emit('debug', arguments);
		};

		console.info = function () {
			mod.emit('notice', arguments);
		};

		console.warn = function () {
			mod.emit('warning', arguments);
		};

		console.error = function () {
			mod.emit('error', arguments);
		};
	};

}(window));

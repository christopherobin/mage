var mithril = require('../../mithril'),
	logger = mithril.core.logger,
	http = require('http'),
	qs = require('querystring');

/**
 * Simple command center client used by the scheduler.
 *
 * Current limitations:
 *     - No hooks.
 *     - No files/blobs.
 *     - No callback.
 *     - No responses (since scheduler's user commands are void).
 *
 */

var CommandCenterClient = function CommandCenterClient(config) {
	this.app = config.app;
	this.host = config.host;
	this.port = config.port || 80;
	if (config.auth) {
		this.auth = config.auth;
	}
	this.peer = [
		"http://",
		this.host,
		":",
		String(this.port)
	].join('');

	this.queue = [];
	this.failed = [];
	this.timer = null;
};

CommandCenterClient.prototype = {
	_onTransportError: function (failedQueue) {
		this.busy = false;
		logger.debug('CommandCenterClient: Will retry ' + failedQueue.length + ' command(s)…');
		this._resendQueue(failedQueue);
	},
	_sendQueue: function () {
		if (this.busy) {
			return this._setTimerIfNeeded();
		}
		this.busy = true;

		var failedItem;
		while ((failedItem = this.failed.pop())) {
			this.queue.unshift(failedItem);
		}

		var queue = this.queue,
			len = queue.length,
			cmdNames = queue.map(function (x) {
				return x.name;
			}),
			cmdParams = queue.map(function (x) {
				return JSON.stringify(x.params);
			}),
			data = '[]\n' + cmdParams.join('\n'),
			path = '/' + this.app + '/' + cmdNames.join(',');

		logger.debug([
			"CommandCenterClient: Sending request to ",
			this.peer,
			path,
			' with data = \n',
			JSON.stringify(data, null, 2)
		].join(''));

		this.timer = null;
		this.queue = [];

		var that = this,
			reqOptions = {
				host: this.host,
				port: this.port,
				path: path,
				method: 'POST',
				headers: {
					"Content-Length": Buffer.byteLength(data)
				}
			};

		if (this.auth) {
			reqOptions.headers.Authorization = 'Basic ' + this.auth;
		}

		var req = http.request(reqOptions, function (res) {
				res.on('end', function () {
					that.busy = false;
				});

				res.on('close', function () {
					logger.error('CommandCenterClient: Disconnected while receiving response from peer ' + that.peer + '.');
					that._onTransportError(queue);
				});

				res.setEncoding('utf8');
				if (res.statusCode !== 200) {
					logger.error('CommandCenterClient: Got an unexpected status from peer ' + that.peer + ': ' + res.statusCode);
					// Will not retry
				}
			});

		req.on('error', function (e) {
			logger.error('CommandCenterClient: Got a transport error from peer ' + that.peer + ': ' + e.message);
			that._onTransportError(queue);
		});

		req.write(data);
		req.end();
	},
	_resendQueue: function (queue) {
		if (this.queue !== queue) {
			if (this.queue.length) {
				// Prepend the old queue to the new one
				while (queue.length) {
					this.queue.unshift(queue.pop());
				}
			} else {
				// New queue is empty, so just replace it.
				this.queue = queue;
			}
		}

		// Wait for 1s before re-sending the queue
		// TODO: make it more flexible/configurable
		this._setTimerIfNeeded(1000);
	},
	_setTimerIfNeeded: function (delay) {
		if (this.timer === null) {
			var self = this;
			this.timer = setTimeout(function () {
				this.timer = null;
				self._sendQueue();
			}, delay || 0);
		}
	},
	send: function (commandName, params) {
		this.queue.push({
			name: commandName,
			params: params || {}
		});
		this._setTimerIfNeeded();
	}
};

module.exports = CommandCenterClient;

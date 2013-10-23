var EventEmitter = require('emitter');
var inherits = require('inherit');

function HttpLongPolling(options) {
	options = options || {};

	var that = this;
	var HttpRequest = require('../http/client.js').HttpRequest;
	var hr = new HttpRequest({
		withCredentials: !!options.withCredentials
	});
	var lastError;
	var request = {};
	var confirmIds = [];

	options.afterRequestInterval = options.afterRequestInterval || 0;
	options.afterErrorInterval = options.afterErrorInterval || 5000;

	this.isRunning = false;

	var send;


	function scheduleNext() {
		if (!that.isRunning) {
			// nothing to schedule if we've been aborted
			return;
		}

		var interval = options.afterRequestInterval;

		if (lastError) {
			interval = options.afterErrorInterval;
		}

		setTimeout(send, interval);
	}


	function ondone(error, response) {
		if (error) {
			lastError = error;

			that.emit('error', error, response);
		} else {
			confirmIds = [];

			if (response !== null && typeof response === 'object') {
				confirmIds.push.apply(confirmIds, Object.keys(response));

				request.callback(response);
			}
		}

		scheduleNext();
	}


	send = function () {
		lastError = null;

		if (confirmIds.length > 0) {
			request.params.confirmIds = confirmIds;
		} else {
			delete request.params.confirmIds;
		}

		hr.send('GET', request.url, request.params, null, request.headers, ondone);
	};


	this.setup = function (url, params, headers, cb) {
		request.url = url;
		request.params = params || {};
		request.params.transport = 'longpolling';
		request.headers = headers || null;
		request.callback = cb;
	};


	this.start = function () {
		if (this.isRunning) {
			// restart, since setup has probably changed

			hr.abort();

			setTimeout(function () {
				send();
			}, 0);
		} else {
			this.isRunning = true;

			send();
		}
	};


	this.abort = function () {
		hr.abort();
		this.isRunning = false;
	};
}

inherits(HttpLongPolling, EventEmitter);

exports.HttpLongPolling = HttpLongPolling;
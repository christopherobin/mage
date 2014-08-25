var EventEmitter = require('emitter');
var inherits = require('inherit');
var HttpRequest = require('../../../../httpServer/transports/http/client.js').HttpRequest;


function HttpPolling(style, options) {
	options = options || {};

	var that = this;
	var hr = new HttpRequest({
		withCredentials: !!options.withCredentials,
		noCache: !!options.noCache
	});
	var lastError;
	var request = {};
	var confirmIds = [];

	var defaultInterval = (style === 'shortpolling') ? 5000 : 0;

	options.afterRequestInterval = options.afterRequestInterval || defaultInterval;
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
				request.callback(response);
			}
		}

		scheduleNext();
	}


	send = function () {
		lastError = null;

		// communicate that we are confirming the successful receiving of previous messages

		if (confirmIds.length > 0) {
			request.params.confirmIds = confirmIds;
		} else {
			delete request.params.confirmIds;
		}

		// send the request

		hr.send('GET', request.url, request.params, null, request.headers, ondone);
	};


	this.setup = function (url, params, headers, cb) {
		params.transport = style;

		request.url = url;
		request.params = params;
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


	this.confirm = function (msgId) {
		confirmIds.push(msgId);
	};


	this.abort = function () {
		hr.abort();
		this.isRunning = false;
	};
}

inherits(HttpPolling, EventEmitter);

exports.HttpPolling = HttpPolling;

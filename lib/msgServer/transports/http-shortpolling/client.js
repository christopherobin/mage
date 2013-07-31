var EventEmitter = require('emitter');
var inherits = require('inherit');

function HttpShortPolling(options) {
	var that = this;
	var HttpRequest = require('../http/client.js').HttpRequest;
	var hr = new HttpRequest();
	var lastError;
	var request = {};
	var confirmIds = [];

	options = options || {};
	options.interval = options.interval || 5000;

	this.isRunning = false;

	var send;


	function scheduleNext() {
		setTimeout(send, options.interval);
	}


	function ondone(error, response) {
		if (error) {
			lastError = error;

			that.emit('error', error);
		} else {
			confirmIds = [];

			if (response !== null && typeof response === 'object') {
				confirmIds.push.apply(confirmIds, Object.keys(response));

				request.callback(response);
			}
		}

		if (that.isRunning) {
			scheduleNext();
		}
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
		request.params.transport = 'shortpolling';
		request.headers = headers || null;
		request.callback = cb;
	};


	this.start = function () {
		if (!this.isRunning) {
			send();

			this.isRunning = true;
		}
	};


	this.abort = function () {
		this.isRunning = false;
	};
}

inherits(HttpShortPolling, EventEmitter);

module.exports.HttpShortPolling = HttpShortPolling;
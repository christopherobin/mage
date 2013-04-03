var EventEmitter = require('emitter');
var inherits = require('inherit');

function Stream_HttpShortPolling(options) {
	var that = this;
	var HttpRequest = require('../http/client.js').HttpRequest;
	var hr = new HttpRequest();
	var request = {};

	options = options || {};
	options.interval = options.interval || 5000;

	this.isRunning = false;

	var send;


	function scheduleNext() {
		setTimeout(send, options.interval);
	}


	function ondone(error, response) {
		if (error) {
			that.emit('error', error);
		} else {
			if (response !== undefined) {
				request.callback(response);
			}
		}

		if (that.isRunning) {
			scheduleNext();
		}
	}


	send = function () {
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

inherits(Stream_HttpShortPolling, EventEmitter);

module.exports.Stream_HttpShortPolling = Stream_HttpShortPolling;
var EventEmitter = require('emitter');
var inherits = require('inherit');
var HttpRequest = require('../../../../httpServer/transports/http/client.js').HttpRequest;


function HttpPollingClient(style, cfg) {
	EventEmitter.call(this);

	var that = this;

	var hr = new HttpRequest(cfg.httpOptions);

	var lastError;
	var endpoint = cfg.url;
	var confirmIds = [];
	var sessionKey;

	var afterRequestInterval = cfg.afterRequestInterval || (style === 'shortpolling' ? 5000 : 0);
	var afterErrorInterval = cfg.afterErrorInterval || 5000;

	this.isRunning = false;

	var send;


	function scheduleNext() {
		if (!that.isRunning) {
			// nothing to schedule if we've been aborted
			return;
		}

		if (lastError) {
			setTimeout(send, afterErrorInterval);
		} else {
			setTimeout(send, afterRequestInterval);
		}
	}


	function ondone(error, response) {
		if (error) {
			lastError = error;

			that.emit('error', { error: error, data: response });
		} else {
			confirmIds = [];

			if (response !== null && typeof response === 'object') {
				that.emit('delivery', response);
			}
		}

		scheduleNext();
	}


	send = function () {
		lastError = null;

		var params = {
			transport: style
		};

		if (sessionKey) {
			params.sessionKey = sessionKey;
		}

		if (confirmIds.length > 0) {
			params.confirmIds = confirmIds.join(',');
		}

		// send the request

		hr.send('GET', endpoint, params, null, null, ondone);
	};


	this.setSessionKey = function (key) {
		sessionKey = key;
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


	this.destroy = function () {
		this.abort();
		this.removeAllListeners();
	};
}

inherits(HttpPollingClient, EventEmitter);


HttpPollingClient.test = function (style, cfg) {
	if (!cfg.url || !cfg.httpOptions) {
		return false;
	}

	return true;
};


exports.HttpPollingClient = HttpPollingClient;

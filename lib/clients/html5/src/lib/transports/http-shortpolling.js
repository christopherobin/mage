// This file has been componentized.
// It now lives in the msgServer module
//  - /lib/msgServer/component.json
//  - /lib/msgServer/transports/http-shortpolling/client.js

(function (window) {

	var mage = window.mage;

	var HttpRequest = mage.io.transports.http;


	function HttpShortPolling(options) {
		var that = this;
		var hr = new HttpRequest();
		var request = {};

		options = options || {};
		options.interval = options.interval || 5000;

		this.isRunning = false;

		var send;


		function scheduleNext() {
			window.setTimeout(send, options.interval);
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


	HttpShortPolling.prototype = new mage.EventEmitter();

	mage.io.transports['http-shortpolling'] = HttpShortPolling;

}(window));

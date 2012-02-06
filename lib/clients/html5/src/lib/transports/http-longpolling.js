(function (window) {

	var mithril = window.mithril;


	function Stream_HttpLongPolling(options) {
		var that = this;
		var HttpRequest = mithril.io.transports.http;
		var hr = new HttpRequest();
		var lastError;
		var request = {};
		var confirmIds = [];

		options = options || {};
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

			window.setTimeout(send, interval);
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

			scheduleNext();
		}


		send = function () {
			lastError = null;

			if (confirmIds.length > 0) {
				request.params.confirmIds = confirmIds;
			} else {
				delete request.params.confirmIds;
			}

			hr.send('GET', request.url, request.params, null, null, ondone);
		};


		this.setup = function (url, params, cb) {
			request.url = url;
			request.params = params || {};
			request.params.transport = 'longpolling';
			request.callback = cb;
		};


		this.start = function (cb) {
			if (this.isRunning) {
				// restart, since setup has probably changed

				hr.abort();

				window.setTimeout(function () {
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


	Stream_HttpLongPolling.prototype = new window.EventEmitter();


	mithril.io.transports['http-longpolling'] = Stream_HttpLongPolling;

}(window));

(function (window) {

	var mithril = window.mithril;

	var HttpRequest = mithril.io.transports.http;


	function Stream_HttpShortPolling(options) {
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
			request.headers = headers || {};
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


	Stream_HttpShortPolling.prototype = new mithril.EventEmitter();

	mithril.io.transports['http-shortpolling'] = Stream_HttpShortPolling;

}(window));

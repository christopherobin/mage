(function () {

	var mithril = window.mithril;

	var HttpRequest = mithril.io.transports.http;


	function Stream_HttpShortPolling(options) {
		var that = this;
		var hr = new HttpRequest();
		var lastError;
		var request = {};

		options = options || {};
		options.interval = options.interval || 5000;


		var send;


		function scheduleNext() {
			window.setTimeout(send, options.interval);
		}


		function ondone(error, response) {
			if (error) {
				lastError = error;
			} else {
				if (response !== undefined) {
					request.callback(response);
				}
			}

			scheduleNext();
		}


		send = function () {
			lastError = null;

			hr.send('GET', request.url, request.params, null, null, ondone);
		};


		this.start = function (url, params, cb) {
			request.url = url;
			request.params = params || {};
			request.params.transport = 'shortpolling';
			request.callback = cb;
			send();
		};
	}

}());

(function () {

	var mithril = window.mithril;

	function Stream_HttpLongPolling(options) {
		var HttpRequest = mithril.io.transports.http;
		var hr = new HttpRequest();
		var lastError;
		var request = {};

		options = options || {};
		options.afterRequestInterval = options.afterRequestInterval || 0;
		options.afterErrorInterval = options.afterErrorInterval || 2000;


		var send;


		function scheduleNext() {
			var interval = options.afterRequestInterval;

			if (lastError) {
				interval = options.afterErrorInterval;
			}

			window.setTimeout(send, interval);
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

			hr.send('GET', request.url, request.params, null, ondone);
		};


		this.start = function (url, params, cb) {
			request.url = url;
			request.params = params || {};
			request.params.transport = 'longpolling';
			request.callback = cb;
			send();
		};
	}

	mithril.io.transports['http-longpolling'] = Stream_HttpLongPolling;

}());

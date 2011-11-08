(function () {

	var mithril = window.mithril;

	function Stream_HttpLongPolling(options) {
		var HttpRequest = mithril.io.transports.http;
		var hr = new HttpRequest();
		var lastError;
		var request = {};
		var confirmIds = [];

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
			console.log('Longpolling response', error, response);

			if (error) {
				lastError = error;
			} else {
				if (response !== undefined) {
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
				confirmIds = [];
			} else {
				delete request.params.confirmIds;
			}

			hr.send('GET', request.url, request.params, null, null, ondone);
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

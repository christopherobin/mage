(function () {

	var mithril = window.mithril;


	function HttpRequest() {

		var xhr = new XMLHttpRequest();
		var callback;
		var isSending = false;


		this.send = function (method, url, params, data, headers, cb) {
			if (isSending) {
				if (cb) {
					cb({ reason: 'busy' });
				}
				return;
			}

			var key;
			headers = headers || {};
			isSending = true;
			callback = cb;

			if (params) {
				var isFirstParam = (url.indexOf('?') === -1);

				for (key in params) {
					if (isFirstParam) {
						url += '?' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
						isFirstParam = false;
					} else {
						url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
					}
				}
			}

			console.log('xhr.open', method, url);

			xhr.open(method, url, true);

			if (data) {
				if (!headers.hasOwnProperty('Content-Type') && !headers.hasOwnProperty('Content-type')) {
					if (typeof data === 'string') {
						headers['Content-Type'] = 'text/plain; charset=UTF-8';
					} else {
						headers['Content-Type'] = 'application/json; charset=UTF-8';
						data = JSON.stringify(data);
					}
				}
			} else {
				data = null;
			}

			for (key in headers) {
				xhr.setRequestHeader(key, headers[key]);
			}

			console.log('xhr.send', data);

			xhr.send(data);
		};


		function oncomplete() {
			isSending = false;

			if (callback) {
				var cb = callback;
				callback = null;

				var respond = false;

				var error, response = xhr.responseText;

				if (~~(xhr.status / 100) !== 2) {
					error = { reason: 'network', status: xhr.status };
				} else {
					var contentType = xhr.getResponseHeader('Content-Type');

					respond = true;

					if (contentType.match(/^[a-z]+\/json/)) {
						try {
							response = JSON.parse(response);
						} catch (e) {
							error = { reason: 'parse-error' };
						}
					} else if (contentType.match('text/plain')) {
						if (response === 'HB') {
							// heartbeat, do nothing

							respond = false;
						}
					}
				}

				if (error) {
					cb(error);
				} else {
					if (respond) {
						cb(null, response);
					} else {
						cb();
					}
				}
			}
		}


		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				window.setTimeout(function () { oncomplete(); }, 0);
			}
		};
	}


	mithril.io.transports.http = HttpRequest;
}());

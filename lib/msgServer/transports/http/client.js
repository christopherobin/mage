function HttpRequest(options) {
	options = options || {};

	var xhr = new XMLHttpRequest();
	var callback;
	var isSending = false;
	var timer;


	this.isBusy = function () {
		return isSending;
	};


	this.send = function (method, url, params, data, headers, cb) {
		if (isSending) {
			if (cb) {
				cb('busy');
			}

			return false;
		}

		var key;
		isSending = true;
		callback = cb;

		headers = headers || {};

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

		xhr.open(method, url, true);

		if (options.withCredentials) {
			xhr.withCredentials = true;
		}

		if (data) {
			var FormData = window.FormData;

			if (!FormData || !(data instanceof FormData)) {
				if (!headers.hasOwnProperty('Content-Type') && !headers.hasOwnProperty('Content-type')) {
					if (typeof data === 'string') {
						xhr.setRequestHeader('Content-Type', 'text/plain; charset=UTF-8');
					} else {
						xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

						data = JSON.stringify(data);
					}
				}
			}
		} else {
			data = null;
		}

		for (key in headers) {
			xhr.setRequestHeader(key, headers[key]);
		}

		if (options.timeout) {
			timer = setTimeout(function () {
				var cb = callback;
				callback = null;

				console.warn('HTTP request timed out, aborting');

				xhr.abort();

				// in some browsers, oncomplete will now fire due to abort()
				// since callback is now null however, it will not do anything

				isSending = false;

				if (cb) {
					cb('network');
				}
			}, options.timeout);
		}

		xhr.send(data);

		return true;
	};


	this.abort = function () {
		// abort does not call any callbacks
		// useful for long polling

		callback = null;
		isSending = false;
		xhr.abort();
	};


	function oncomplete() {
		// possible error codes:
		// 'auth': authentication issue
		// 'network': connection issue
		// 'server': server side error while handling request

		isSending = false;

		if (!callback) {
			return;
		}

		var cb = callback;
		callback = null;

		var respond = false;

		var error, response = xhr.responseText;
		var code = xhr.status;
		var codeCategory = (code / 100) >>> 0;

		if (codeCategory !== 2) {
			// error situation

			switch (code) {
			case 401:
			case 403:
			case 405:
				error = 'auth';

				if (response) {
					error.message = response;
				}
				break;
			case 503:
				error = 'maintenance';
				break;
			default:
				error = 'network';
				break;
			}

			console.warn('HTTP response code:', code, 'set as error:', error);
		}

		if (!error) {
			var contentType = xhr.getResponseHeader('Content-Type');

			if (contentType) {
				respond = true;

				if (contentType.match(/^[a-z]+\/json/)) {
					try {
						response = JSON.parse(response);
					} catch (e) {
						console.warn('JSON parse error on response', response);

						error = 'server';
					}
				} else if (contentType.match('text/plain')) {
					if (response === 'HB') {
						// heartbeat, do nothing

						respond = false;
					}
				}
			} else {
				// the server should always provide a content type if there is no error.
				// if it's not available, consider it a server error
				// this way the error delay also kicks in

				console.warn('No content type', response);

				error = 'server';
			}
		}

		if (error) {
			cb(error, response);
		} else {
			if (respond) {
				cb(null, response);
			} else {
				cb();
			}
		}
	}


	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}

			setTimeout(function () {
				oncomplete();
			}, 0);
		}
	};
}

exports.HttpRequest = HttpRequest;

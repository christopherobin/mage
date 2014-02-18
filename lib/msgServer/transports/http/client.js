var cachepuncher = require('cachepuncher');


function deepCopy(obj) {
	var out;

	if (Array.isArray(obj)) {
		var len = obj.length;

		out = new Array(len);

		for (var i = 0; i < len; i++) {
			out[i] = deepCopy(obj[i]);
		}
	} else if (obj && typeof obj === 'object') {
		out = {};

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				out[key] = deepCopy(obj[key]);
			}
		}
	} else {
		out = obj;
	}

	return out;
}


function addParamsToUrl(url, params) {
	if (!params) {
		return url;
	}

	var keys = Object.keys(params);
	var count = keys.length;

	if (count === 0) {
		return url;
	}

	var splitter = url.indexOf('?') === -1 ? '?' : '&';

	for (var i = 0; i < count; i += 1) {
		var key = keys[i];

		url += splitter + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);

		splitter = '&';
	}

	return url;
}


function HttpRequest(options) {
	options = options || {};

	var xhr = new XMLHttpRequest();
	var callback;
	var isSending = false;
	var timer;
	var FormData = window.FormData;


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

		isSending = true;
		callback = cb;

		headers = headers || {};

		var m = url.match(/^[a-z]+:(\/\/)([^:]+:[^:]+)@/i);
		if (m) {
			headers.Authorization = 'Basic ' + window.btoa(m[2]);
		}

		if (params) {
			if (options.noCache) {
				params = deepCopy(params);
				params.rand = cachepuncher.punch();
			}

			url = addParamsToUrl(url, params);
		}

		xhr.open(method, url, true);

		if (options.withCredentials) {
			xhr.withCredentials = true;
		}

		if (data) {
			if (!FormData || !(data instanceof FormData)) {
				if (!headers.hasOwnProperty('content-type') && !headers.hasOwnProperty('content-type')) {
					if (typeof data === 'string') {
						xhr.setRequestHeader('content-type', 'text/plain; charset=UTF-8');
					} else {
						xhr.setRequestHeader('content-type', 'application/json; charset=UTF-8');

						data = JSON.stringify(data);
					}
				}
			}
		} else {
			data = null;
		}

		for (var key in headers) {
			xhr.setRequestHeader(key, headers[key]);
		}

		if (options.timeout) {
			if (options.timeout < 1000) {
				throw new Error('Unreasonable timeout setting for HTTP request: ' + options.timeout + ' msec.');
			}

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
			var contentType = xhr.getResponseHeader('content-type');

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

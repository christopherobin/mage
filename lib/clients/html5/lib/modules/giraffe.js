(function () {

	var mithril = window.mithril;

	var mod = {
		tokenData: null
	};

	mithril.registerModule('giraffe', mod);

	var giraffePlugin = window.giraffe;

	var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';


	mithril.io.registerCommandHook('giraffe', function (message) {
		// TODO: SHA256 should be part of this module

		var sha256 = window.SHA256;

		if (!sha256) {
			throw 'Could not apply giraffe command hook, because window.SHA256 was not found.';
		}

		var tokenSecret = mod.tokenData.access_secret;

		var nonce = Math.random() * 0xFFFFFFFF + '' + Math.random() * 0xFFFFFFFF + Math.random() * 0xFFFFFFFF + '' + Math.random() * 0xFFFFFFFF;

		var reqTimestamp = (Date.now() / 1000) >>> 0;
		var reqHash = sha256(tokenSecret + nonce + reqTimestamp + message);

		return {
			header: { name: 'giraffe', nonce: nonce, timestamp: reqTimestamp, hash: reqHash },
			message: message
		};
	});


	function getTokenData(cb) {
		if (mod.tokenData) {
			return cb(null, mod.tokenData);
		}

		if (!giraffePlugin) {
			console.error('Giraffe plugin missing, unable to authenticate.');
			return cb('fatal');
		}

		giraffePlugin.authenticateAndGetTokens(
			function (data) {
				// success callback

				mod.tokenData = data;
				cb();
			},
			function (error) {
				// error callback

				console.error('Giraffe authentication failed.', error);
				cb('auth');
			}
		);
	}


	function requestSession(cb) {
		var giraffeUserId = mod.tokenData.giraffeUserId;
		var tokenSecret = mod.tokenData.access_secret;

		// Prepare the request to Giraffe getSession API call

		var nonce = Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32) + Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32);
		var timestamp = (Date.now() / 1000) >>> 0;
		var hash = window.SHA256(tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId);

		var escape = window.escape;

		var url = origin + '/giraffe/getsession?giraffeUserId=' + escape(giraffeUserId) + '&nonce=' + escape(nonce) + '&timestamp=' + escape(timestamp) + '&hash=' + escape(hash);

		var xhr = new XMLHttpRequest();

		xhr.open('GET', url, true);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				// request complete

				if (xhr.status === 200) {
					try {
						var response = JSON.parse(xhr.responseText);

						mithril.session.setSessionKey(response.sessionId);

						cb();
					} catch (e) {
						// parse error
						cb('parseError');
					}
				} else {
					// server/connection error

					cb('badConnection');
				}
			}
		};

		xhr.send(null);
	}


	mod.authenticate = function (cb) {
		getTokenData(function (error) {
			if (error) {
				return cb(error);
			}

			requestSession(cb);
		});
	};

}());

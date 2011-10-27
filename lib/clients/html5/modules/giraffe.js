(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('giraffe', mod);


	mod.authenticate = function (tokenData, cb) {
		var giraffeUserId = tokenData.giraffeUserId;
		//var token = tokenData.access_token;
		var tokenSecret = tokenData.access_secret;

		// Prepare the request to Giraffe getSession API call

		var nonce = Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32) + Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32);
		var timestamp = (Date.now() / 1000) >>> 0;
		var hash = window.SHA256(tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId);

		var escape = window.escape;
		var origin = window.mithrilOrigin || '';

		var url = origin + '/giraffe/getsession?giraffeUserId=' + escape(giraffeUserId) + '&nonce=' + escape(nonce) + '&timestamp=' + escape(timestamp) + '&hash=' + escape(hash);

		var xhr = new XMLHttpRequest();

		xhr.open('GET', url, true);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				// request complete

				if (xhr.status === 200) {
					try {
						var response = JSON.parse(xhr.responseText);

						cb(response.playerId, response.sessionId);
					} catch (e) {
						// parse error
						cb();
					}
				} else {
					// server/connection error
					cb();
				}
			}
		};

		xhr.send(null);
	};

}());

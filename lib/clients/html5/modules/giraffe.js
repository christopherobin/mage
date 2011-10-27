(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('giraffe', mod);


	mod.setup = function (cb) {
		cb();
	};

	mod.authenticate = function (tokenData, cb) {
		var origin = window.mithrilOrigin || '';	
		console.log("Giraffe user data: ");

		var giraffeUserId = tokenData.giraffeUserId;
		//var token = tokenData.access_token;
		var tokenSecret = tokenData.access_secret;
		// TODO: Need to do some error handling here

		
		// Prepare the request to Giraffe getSession API call
		var nonce = Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32) + Math.random() * Math.pow(2, 32) + '' + Math.random() * Math.pow(2, 32);
		var timestamp = (Date.now() / 1000) >>> 0;
		var hash = window.SHA256(tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId);

		var url = origin + "/giraffe/getsession";

		var http = new XMLHttpRequest();
		http.open("GET", url + "?giraffeUserId=" + window.escape(giraffeUserId) + "&nonce=" + window.escape(nonce) + "&timestamp=" + window.escape(timestamp) + "&hash=" + window.escape(hash), true);
		http.onreadystatechange = function () {
			if (http.readyState === 4) {
				if (http.status === 200) {
					var response = http.responseText;
					var responseData = JSON.parse(response);

					cb(responseData.playerId, responseData.sessionId);
				}
			}
		};
		
		http.send(null);
	};

}());

var mithril = require('../../mithril'),
	common = require('./common'),
	querystring = require('querystring'),
    crypto = require('crypto');


function OAuth(endpoint, appId, consumer) {
	this.endpoint = endpoint;
	this.appId = appId.toString();
	this.consumer = consumer;
}


exports.OAuth = OAuth;


OAuth.prototype.isValidAppId = function (appId) {
	return (appId.toString() === this.appId);
};


OAuth.prototype.isValidSignature = function (httpMethod, url, params, authHeader) {
	if (authHeader) {
		authHeader = this.parseAuthorizationHeader(authHeader);

		for (var key in authHeader) {
			params[key] = authHeader[key];
		}
	}

	// check for availability of all required oauth params

	if (!('oauth_signature' in params)) {
		return false;
	}

	var signature = params.oauth_signature;
	var tokenSecret = ('oauth_token_secret' in params) ? params.oauth_token_secret : '';

	delete params.oauth_signature;

	var genSignature = this.generateSignature(httpMethod, url, params, tokenSecret);

	return (genSignature === signature);
};


OAuth.prototype.generateSignature = function (httpMethod, url, params, tokenSecret) {
	var sorted = [];

	for (var key in params) {
		sorted.push(key + '=' + common.encodeRfc3986(params[key]));
	}

	sorted.sort();

	var baseString = httpMethod.toUpperCase() + '&' + common.encodeRfc3986(url) + '&' + common.encodeRfc3986(sorted.join('&'));

	var oauthKey = this.consumer.secret + '&' + tokenSecret;

	return crypto.createHmac('sha1', oauthKey).update(baseString).digest('base64');
};


OAuth.prototype.extractAuthorizationHeader = function (headers) {
	if (headers) {
		var header = headers.authorization;

		if (header && header.substring(0, 5) === 'OAuth') {
			return header;
		}
	}

	return null;
};


OAuth.prototype.parseAuthorizationHeader = function (authHeader) {
	// Authorization: OAuth oauth_version="1.0",oauth_nonce="32432423423423",oauth_timestamp="123123322",oauth_consumer_key="34ewr23fweafewewfwe",oauth_token="fwfewwefwfe",oauth_signature="Izti%2FxtMrMD5iZaLDm0Y%2B6Mm23g%3D",oauth_signature_method="HMAC-SHA1",oauth_token_secret="weffwefwefweefw"

	var result = {};
	var matches = authHeader.match(/oauth_([a-z_\-]*)=(:?"([^"]*)"|([^,]*))/g);

	for (var i = 0, len = matches.length; i < len; i++) {
		// oauth_nonce="32432423423423"  etc...

		var match = matches[i].split('=');
		var key = match[0];
		var value = match[1];

		if (value[0] === '"' && value[value.length - 1] === '"') {
			value = value.substring(1, value.length - 1);
		}

		result[key] = querystring.unescape(value);
	}

	return result;
};


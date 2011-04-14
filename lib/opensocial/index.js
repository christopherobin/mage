
var crypto = require('crypto');

function encodeRfc3986(str)
{
	return encodeURIComponent(str).replace(/\!/g,'%21').replace(/\*/g,'%2A').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\'/g,'%27');
};


function OpenSocial(options)
{
	this.appId          = options.appId;
	this.consumerKey    = options.consumerKey;
	this.consumerSecret = options.consumerSecret;
	this.baseUrl        = options.baseUrl || '';
	this.hmacMethod     = options.hmacMethod || 'HMAC-SHA1';
}


OpenSocial.prototype.authenticateUser = function(httpMethod, url, params, authHeader)
{
	if (!('opensocial_app_id'    in params)) return false;
	if (!('opensocial_viewer_id' in params)) return false;
	if (!('oauth_token'          in params)) return false;
	if (!('oauth_token_secret'   in params)) return false;

	if (params.opensocial_app_id != this.appId) return false;
	if (!this.oauth.isValidSignature(httpMethod, url, params, authHeader)) return false;

	return { viewerId: params.opensocial_viewer_id, token: params.oauth_token, tokenSecret: params.oauth_token_secret };
};


OpenSocial.prototype.oauth =
{
	parseAuthorizationHeader: function(authHeader)
	{
		// Authorization: OAuth oauth_version="1.0",oauth_nonce="32432423423423",oauth_timestamp="123123322",oauth_consumer_key="34ewr23fweafewewfwe",oauth_token="fwfewwefwfe",oauth_signature="Izti%2FxtMrMD5iZaLDm0Y%2B6Mm23g%3D",oauth_signature_method="HMAC-SHA1",oauth_token_secret="weffwefwefweefw"

		var matches = authHeader.match(/oauth_([a-z_-]*)=(:?"([^"]*)"|([^,]*))/g);
		var len = matches.length;
		var result = {};

		for (var i=0; i < len; i++)
		{
			// oauth_nonce="32432423423423"  etc...

			var match = matches[i].split('=');
			var key = match[0];
			var value = match[1];

			if (value[0] == '"' && value[value.length-1] == '"')
			{
				value = value.substring(1, value.length-1);
			}

			result[key] = unescape(value);
		}

		return result;
	},

	generateSignature: function(httpMethod, url, params, tokenSecret)
	{
		var sorted = [];

		for (var key in params)
		{
			sorted.push(key + '=' + encodeRfc3986(params[key]));
		}

		sorted.sort();

		var baseString = httpMethod.toUpperCase() + '&' + encodeRfc3986(url) + encodeRfc3986(sorted.join('&'));
		var oauthKey = this.consumerSecret + '&' + tokenSecret;

		return crypto.createHmac('sha1', oauthKey).update(baseString).digest('base64');
	},

	isValidSignature: function(httpMethod, url, params, authHeader)
	{
		if (authHeader)	// optional, may also be provided through params
		{
			authHeader = this.parseAuthorizationHeader(authHeader);
			for (var key in authHeader)
			{
				params[key] = authHeader[key];
			}
		}

		// check for availability of all required oauth params

		if (!('oauth_signature' in params)) return false;

		var signature = params.oauth_signature;
		var tokenSecret = ('oauth_token_secret' in params) ? params.oauth_token_secret : '';

		delete params.oauth_signature;

		var genSignature = this.generateSignature(httpMethod, url, params, tokenSecret);

		return (genSignature == signature);
	}
};


OpenSocial.prototype.rest = function(httpMethod, user, path, getData, postData)
{
	var now = new Date;
	var url = this.baseUrl + path;
	var nonceData = process.pid + now.getTime() + Math.random();
	var nonce = crypto.createHash('md5').update(nonceData).digest('hex');
	var timestamp = Math.round(now.getTime() / 1000);

	var oauthParams = [
		'oauth_consumer_key=' + this.consumerKey,
		'oauth_nonce=' + nonce,
		'oauth_signature_method=' + this.hmacMethod,
		'oauth_timestamp=' + timestamp,
		'oauth_token=' + user.token,
		'oauth_version=1.0',
		'xoauth_requestor_id=' + user.viewerId
	];

	var callParams = [];

	if (getData)
	{
		for (var key in getData)
		{
			var str = key + '=' + encodeRfc3986(getData[key]);
			callParams.push(str);
			oauthParams.push(str);
		}

		oauthParams.sort();
	}

	oauthParams.oauth_signature = this.oauth.generateSignature(httpMethod, url, oauthParams, user.oauth_token_secret);

	var authHeader = 'Authorization: OAuth ' + oauthParams.map(function(value, key) { return key + '="' + encoreRfc3986(value) + '"'; }).join(',');

	// .......

};


OpenSocial.prototype.people = {
	get: function(guid, selector, fields, onfinish)
	{
		onfinish(false, { everyRequestedFieldAndTheirValues });
	}
};


exports.OpenSocial = OpenSocial;


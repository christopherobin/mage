var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');


function HttpPollingHost(style, timeout) {
	assert(style === 'shortpolling' || style === 'longpolling', 'Invalid HttpPolling style');

	EventEmitter.call(this);

	this.style = style;
	this.timeout = timeout;
	this.res = null;

	this.confirmIds = null;
	this.sessionKey = null;
}

util.inherits(HttpPollingHost, EventEmitter);

exports.HttpPollingHost = HttpPollingHost;


HttpPollingHost.prototype.setConnection = function (req, res) {
	this.res = res;

	var query = url.parse(req.url, true, true).query || {};

	if (query.confirmIds) {
		this.confirmIds = query.confirmIds.split(',');
	}

	if (query.sessionKey) {
		this.sessionKey = query.sessionKey;
	}

	// set up heartbeat timeout and premature connection-lost handling

	this._setupConnectionManagement(req, this.timeout);
};


HttpPollingHost.prototype._closeConnection = function () {
	if (!this.res) {
		return;
	}

	this.res = null;
	this.emit('close');
	this.removeAllListeners();
};


HttpPollingHost.prototype.getSessionKey = function () {
	return this.sessionKey;
};


HttpPollingHost.prototype.getConfirmIds = function () {
	var ids = this.confirmIds;

	this.confirmIds = null;

	return ids;
};


HttpPollingHost.prototype._setupConnectionManagement = function (req, timeout) {
	// heartbeat

	var that = this;

	if (timeout) {
		req.setTimeout(timeout, function () {
			that._sendHeartbeat();
		});
	}

	// "close" indicates that the underlaying connection was terminated before response.end() was
	// called or able to flush.

	req.on('close', function () {
		that._closeConnection();
	});
};


HttpPollingHost.prototype.deliver = function (msgs) {
	// msgs: [id, content, id, content, id, content, etc...]

	// build a response JSON string
	// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

	if (msgs.length === 0) {
		if (this.style === 'shortpolling') {
			this.res.writeHead(204, {
				pragma: 'no-cache'
			});

			this.res.end();
			this._closeConnection();
		}
		return;
	}

	var props = [];

	for (var i = 0, len = msgs.length; i < len; i += 2) {
		var id = msgs[i];
		var msg = msgs[i + 1];

		props.push('"' + id + '":' + msg);
	}

	this.res.writeHead(200, {
		'content-type': 'application/json',
		pragma: 'no-cache'
	});

	this.res.end('{' + props.join(',') + '}');
	this._closeConnection();
};


HttpPollingHost.prototype.sendServerError = function () {
	// used when we fail to confirm a session key for example

	if (!this.res) {
		return;
	}

	this.res.writeHead(500, { // 500: Internal service error
		pragma: 'no-cache'
	});

	this.res.end();
	this._closeConnection();
};


HttpPollingHost.prototype._sendHeartbeat = function () {
	if (!this.res) {
		return;
	}

	this.res.writeHead(204, {
		pragma: 'no-cache'
	});

	this.res.end();
	this._closeConnection();
};


HttpPollingHost.prototype.close = function () {
	this._sendHeartbeat();
};

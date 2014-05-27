// We need the following to avoid an error due to a circular dependency.
/* jshint latedef: false */

var http = require('http');
var url = require('url');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Attempts to send a queue of commands.
 *
 * @param {Object} client An instance of CommandCenterClient
 * @private
 */

function sendQueue(client) {
	if (client.busy) {
		var delay = 1000;

		if (!client.busyWarningOutput) {
			client.logger.warning('Queue is busy, cannot yet send. Retrying every', delay, 'msec.');

			client.busyWarningOutput = true;
		}

		return setTimerIfNeeded(client, delay);
	}

	client.busyWarningOutput = false;
	client.busy = true;

	var queue = client.queue;

	var cmdNames = queue.map(function (x) {
		return x.name;
	});

	var cmdParams = queue.map(function (cmd) {
		return JSON.stringify(cmd.params);
	});

	// Generate a basePath and ensure that it starts and ends with a slash.
	// eg: "/foo/", "/foo/bar/" or "/"

	var endpoint = client.endpoint;

	var basePath = endpoint.path || '/';

	if (basePath[basePath.length - 1] !== '/') {
		basePath += '/';
	}

	if (basePath[0] !== '/') {
		basePath = '/' + basePath;
	}

	var path = basePath + client.app + '/' + cmdNames.join(',');

	var peer = client.peer;

	if (peer[peer.length - 1] === '/') {
		peer = peer.substring(0, client.peer.length - 1);
	}

	var url = peer + path;

	var data = '[]\n' + cmdParams.join('\n');

	var oneline = data.replace(/\n/g, '\\n').replace(/'/g, '\\\'');

	client.logger
		.debug
		.details('curl -i -d $\'' + oneline + '\' \'' + url.replace(/'/g, '\\\'') + '\'')
		.data({
			commandNames: cmdNames,
			url: url,
			data: data
		})
		.log('Sending user command request batch');

	client.timer = null;
	client.queue = [];


	var reqOptions = {
		method: 'POST',
		auth: endpoint.auth,
		hostname: endpoint.hostname,
		port: endpoint.port,
		path: path,
		headers: {
			'content-length': Buffer.byteLength(data)
		}
	};

	var req = http.request(reqOptions, function (res) {
		res.on('end', function () {
			client.busy = false;
		});

		res.on('close', function () {
			client.logger.error.data({
				request: reqOptions,
				data: data
			}).log('Disconnected while receiving response from peer', client.peer);

			client.emit('transportError', queue);
		});

		// since node 0.10, streams2 and more won't start if you don't listen on data
		// just override this by telling the stream to resume
		res.resume();

		if (res.statusCode !== 200) {
			client.logger.error.data({
				request: reqOptions,
				data: data
			}).log('Got an unexpected status from peer', client.peer + ':', res.statusCode);

			client.emit('serverError', queue, res.statusCode);
		}
	});

	req.on('error', function (e) {
		client.busy = false;
		client.logger.error.data({
			request: reqOptions,
			data: data
		}).log('Got a transport error from peer', client.peer + ':', e.message);

		client.emit('transportError', queue);
	});

	req.write(data);
	req.end();
}


/**
 * Adds a delay to sending a queue.
 *
 * @param {Object} client  an instance of CommandCenterClient
 * @param {Number} [delay] milliseconds
 * @private
 */

function setTimerIfNeeded(client, delay) {
	if (client.timer) {
		// timer is already set up, no need to do it again
		return;
	}

	delay = typeof delay === 'number' ? delay : 1000;

	client.timer = setTimeout(function () {
		client.timer = null;

		sendQueue(client);
	}, delay);
}


/**
 * Simple command center client used by the scheduler.
 *
 * Current limitations:
 *  - No hooks.
 *  - No files/blobs.
 *  - No callback.
 *  - No responses.
 *
 * @param {string} app      The name of the application we're talking to.
 * @param {Object} endpoint The "expose" configuration of the other end.
 * @param {Object} logger   A logger.
 * @constructor
 */

function CommandCenterClient(app, endpoint, logger) {
	EventEmitter.call(this);

	this.logger = logger;
	this.app = app;

	if (typeof endpoint === 'string') {
		endpoint = url.parse(endpoint);
	}

	endpoint.protocol = endpoint.protocol || 'http';

	this.peer = url.format(endpoint);  // only used for logging
	this.endpoint = endpoint;

	this.queue = [];
	this.timer = null;

	this.busyWarningOutput = false;
}

util.inherits(CommandCenterClient, EventEmitter);

/**
 * Sends a command.
 *
 * @param {String} commandName
 * @param {Object} params
 */

CommandCenterClient.prototype.send = function (commandName, params) {
	this.queue.push({
		name: commandName,
		params: params || {}
	});

	setTimerIfNeeded(this, 0);
};


// Expose the constructor
exports.CommandCenterClient = CommandCenterClient;

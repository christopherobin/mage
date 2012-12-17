var mithril = require('./mithril');
var Panopticon = require('./Panopticon');
var processManager = require('./processManager');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

// panoptica is an array with each element a panopticon. Multiple may be needed for different
// sample intervals.
var panoptica = [];
var init;

/**
 * If we want to send something to all instances of panoptica, it goes through here.
 *
 * @param {String} method A method of an individual panopticon.
 * @return {Function} The returned function is a wrapper around method of all panoptica.
 */
function createSamplerMethod(method) {
	return function (n) {
		for (var i = 0, len = panoptica.length; i < len; i++) {
			panoptica[i][method](n);
		}
	};
}

// Exported functions are just forwarding to methods of panoptica of the same name.
exports.inc         = createSamplerMethod('inc');
exports.set         = createSamplerMethod('set');
exports.sample      = createSamplerMethod('sample');
exports.timedSample = createSamplerMethod('timedSample');

// Data cache to be served. When a panopticon reports on any worker the data is placed in here.
var gatheredData = {};


/**
 * Register events with an instance of panopticon.
 *
 * @param {Object} panopticon
 */

function setupEventCounters(panopticon) {
	var state = require('./state');
	var mysql = require('./datasources/mysql');
	var datasources = require('./datasources');
	var commandCenter = require('./commandCenter');

	processManager.on('workerOffline', function () {
		panopticon.inc(null, 'workerOffLine', 1);
	});

	state.on('error', function () {
		panopticon.inc(['state'], 'errors', 1);
	});

	state.on('created', function () {
		panopticon.inc(['state'], 'created', 1);
	});

	state.on('destroyed', function () {
		panopticon.inc(['state'], 'destroyed', 1);
	});

	state.on('timeOut', function () {
		panopticon.inc(['state'], 'timeOut', 1);
	});

	mysql.on('error', function (errorCode, errorNum) {
		panopticon.inc(['datasources', 'mysql'], errorCode + ':' + errorNum, 1);
	});

	mysql.on('mysqlQuery', function () {
		panopticon.inc(['datasources', 'mysql'], 'queries', 1);
	});

	mysql.on('mysqlQueryDuration', function (duration) {
		panopticon.timedSample(['datasources', 'mysql'], 'duration', duration);
	});

	datasources.on('datasourceConnect', function () {
		panopticon.inc(['datasources'], 'connects', 1);
	});

	datasources.on('datasourceDisconnect', function () {
		panopticon.inc(['datasources'], 'disconnects', 1);
	});

	commandCenter.on('openPostConnection', function (app) {
		panopticon.inc([app.name, 'postConnections'], 'opened', 1);
	});

	commandCenter.on('closePostConnection', function (app) {
		panopticon.inc([app.name, 'postConnections'], 'closed', 1);
	});

	commandCenter.on('completed', function (app, cmd, duration) {
		panopticon.timedSample([app.name, 'userCommands'], cmd.name, duration);
	});
}


/**
 * Each interval we may want to set some data. A panopticon instance needs to tell us when we can
 * do this. This function registers the listener.
 *
 * @param {Object} panopticon
 */

function perIntervalSets(panopticon) {
	panopticon.on('newInterval', function () {
		panopticon.set(null, 'pid', process.pid);
	});
}


/**
 * Query the current aggregate using a path array. This is on the exports object so that it remains
 * available to the game programmer before mithril.setup is called.
 *
 * @param {String[]} path An array of keys used to address an arbitrary position in an object.
 */

exports.query = function (path) {
	var response = gatheredData;
	var endTime;

	// If we're looking inside data for the master, and we won't have access to endTime, grab it
	// here for later placement.
	if (path.length > 2 && path[1] === 'master' && path[2] !== 'endTime') {
		endTime = response[path[0]][path[1]].endTime;
	}

	// If we're looking inside data for workers, and we won't have access to endTime, grab it here
	// for later placement.
	if (path.length > 3 && path[1] === 'workers' && path[3] !== 'endTime') {
		endTime = response[path[0]][path[1]][path[2]].endTime;
	}

	// Dig into the path.
	for (var i = 0, len = path.length; i < len; i++) {
		var subPath = path[i];

		// Return early and respond with 404 if this path doesn't resolve.
		if (!response.hasOwnProperty(subPath)) {
			return new Error('noMatchingPath');
		}

		// The sub path resolved. Move the reference along and continue.
		response = response[subPath];
	}

	// If we had to grab the endTime earlier, append it to whichever object we have in the end. If
	// the value we grabbed is scalar, do nothing. It's your own damn problem if you're
	// circumventing types.
	if (endTime && typeof response === 'object') {
		response.endTime = endTime;
	}

	return response;
};


/**
 * Simple wrapper for setting up a server listening to a unix socket file.
 *
 * @param {Object} server
 * @param {String} file
 * @param {String} protocol
 */

function unixSocketListen(server, file, protocol, cb) {
	server.listen(file, function (error) {
		if (error) {
			mithril.core.logger.error(error);
			return cb(error);
		}

		require('fs').chmod(file, parseInt('777', 8));

		mithril.core.logger.notice('Sampler running at ' + protocol + '://' + file);
		return cb();
	});
}


/**
 * Simple wrapper for setting up a server listening on a port.
 *
 * @param {Object} server
 * @param {Number} port
 * @param {String} host
 * @param {String} protocol
 */

function hostPortListen(server, port, host, protocol, cb) {
	server.listen(port, host, function (error) {
		if (error) {
			mithril.core.logger.emergency(error);
			return cb(error);
		}

		var address = server.address();

		mithril.core.logger.notice('Sampler running at ' + protocol + '://' + address.address + ':' + address.port);
		return cb();
	});
}


/**
 * If this process is the master, create a server to host the gathered data based upon config.
 *
 * @param {Function} cb
 */

function startServing(cb) {
	if (processManager.isWorker) {
		return cb();
	}

	// Process a url into a path array.
	function urlToPath(url) {
		var parsed = require('url').parse(url);

		if (!parsed.hasOwnProperty('pathname') || parsed.pathname === '/') {
			return [];
		}

		var path = parsed.pathname.split('/');

		// If the request had a trailing '/', remove the resulting empty final element in the path.
		if (path[path.length - 1] === '') {
			path.pop();
		}

		// Remove the useless '' (zeroth) element.
		path.shift();

		return path;
	}


	if (!init.bind) {
		mithril.core.logger.warning('Sampler is collecting data, but no configuration was found for serving.');
		return cb();
	}

	var server = require('http').createServer(function (req, res) {
		var data = exports.query(urlToPath(req.url));

		if (data instanceof Error) {
			res.writeHead(404, {});
			res.end();
		} else {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(data, null, '  '));
		}
	});

	mithril.once('shutdown', function () {
		server.close();
	});

	// The below is patterned on the clientHost solution. If neither 'file' nor 'port' are found in
	// 'init.bind', then it falls through.

	if (init.bind.hasOwnProperty('file')) {
		mithril.core.logger.debug('Sampler about to listen on', init.bind.file);
		return unixSocketListen(server, init.bind.file, init.protocol, cb);
	}

	if (init.bind.hasOwnProperty('port')) {
		mithril.core.logger.debug('Sampler about to listen on port', init.bind.port);
		return hostPortListen(server, init.bind.port, init.bind.host, init.protocol, cb);
	}

	return cb();
}


/**
 * Reads the config file for sampler configuration. Based on this it spawns panoptica.
 *
 * @param {Function} cb
 */

exports.setup = function (cb) {
	// We need some initialisation data from config.
	init = mithril.core.config.get('sampler');

	// If no intervals are given, skip the rest.
	if (!init || !init.intervals || init.intervals.length === 0) {
		return cb();
	}

	// If the intervals given was not an array or finite number, then error and return from this
	// function early.
	if (!Array.isArray(init.intervals) && !Number.isFinite(init.intervals)) {
		if (!processManager.isWorker) {
			mithril.core.logger.error('intervals must be a number or an array of numbers.');
		}

		return cb(new Error('intervals must be a number or an array of numbers.'));
	}

	// Assemble a list of interval(s), removing repeated elements.
	var intervals = [].concat(init.intervals).reduce(function (stack, element) {
		return stack.indexOf(element) === -1 ? stack.concat(element) : stack;
	}, []);

	// Panopticon reports in milliseconds by default. We want seconds, so we pass in this scale
	// factor.
	var scaleFactor = 1000;

	// Once a sampler has submitted a single log, we want it to be reset, not deleted between
	// intervals.
	var persist = true;

	// We want to report with data types.
	var logType = true;

	// If there was one or more repeated elements, warn and continue.
	if (!processManager.isWorker && Array.isArray(init.intervals) && intervals.length !== init.intervals.length) {
		mithril.core.logger.warning('Config sampler intervals had repeated elements.');
	}

	// Create a list of new panoptica to accept samples.
	panoptica = intervals.map(function (interval) {
		return new Panopticon(processManager.startTime, interval, scaleFactor, persist, logType);
	});

	// In the case of truthy sampleMithril, we want to use the default loggers and setters.
	if (init && init.sampleMithril) {
		panoptica.forEach(function (panopticon) {
			setupEventCounters(panopticon);
			perIntervalSets(panopticon);
		});
	}

	// When a panopticon delivers a dataset, update the
	panoptica.forEach(function (panopticon) {
		panopticon.on('delivery', function (data) {
			gatheredData[data.interval] = data;
			exports.emit('updatedData', gatheredData);
		});
	});

	// Each panopticon involves node timers. Upon mithril shutdown these need to be dealt with.
	mithril.once('shutdown', function () {
		panoptica.forEach(function (panopticon) {
			panopticon.stop();
		});
	});

	return startServing(cb);
};
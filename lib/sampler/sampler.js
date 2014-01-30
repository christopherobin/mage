var mage;
var logger;
var processManager;

var url = require('url');
var Panopticon = require('panopticon');
var EventEmitter = require('events').EventEmitter;
var mageSamplers = require('./mageSamplers');

var SAVVY_ROUTE = '/sampler';

var panoptica = [];

// Data cache to be served. When a panopticon reports on any worker the data is placed in here.

var gatheredData = {};

// Data buffer. This keeps `n` data sets for each panopticon. `n` is determined by configuration.

var bufferedData = {};

// A list of current panopticon logging methods. This array is a *copy* of the one used internally
// by Panopticon. i.e. it is not a reference and won't appear to be updated if new Panopticon
// logger methods are added.

var panopticonMethods = Panopticon.getLoggerMethodNames();

// Make this module an event emitter.
exports = module.exports = new EventEmitter();


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} mageInstance  A mage instance.
 * @param {Object} mageLogger    A mage logger.
 * @param {Object} procManager   The process manager library.
 * @param {Object} state         The state module.
 * @param {Object} commandCenter The command center module.
 * @param {Object} archivist     The archivist core library.
 * @param {Object} msgServer     The message server library.
 */

exports.initialize = function (mageInstance, mageLogger, procManager, state, commandCenter, archivist, msgServer) {
	mage = mageInstance;
	logger = mageLogger;
	processManager = procManager;

	mageSamplers.initialize(procManager, state, commandCenter, archivist, msgServer);
};


/**
 * Query the current aggregate using a path array. This is on the exports object so that it remains
 * available to the game programmer before mage.setup is called.
 *
 * @param {String[]} path An array of keys used to address an arbitrary position in an object.
 */

exports.query = function (path) {
	var response = gatheredData;

	// Dig into the path.
	for (var i = 0; i < path.length; i++) {
		var subPath = path[i];

		// Return early and respond with 404 if this path doesn't resolve.
		if (!response.hasOwnProperty(subPath)) {
			return new Error('noMatchingPath');
		}

		// The sub path resolved. Move the reference along and continue.
		response = response[subPath];
	}

	return response;
};


/**
 * Expose a panopticon instance logger method on this module. This newly exposed method forwards
 * its arguments to the equivalent method of all panopticon instances.
 *
 * @param {String} method The name of a panopticon instance logger method.
 */

function exposePanopticonMethod(method) {
	exports[method] = function () {
		for (var i = 0; i < panoptica.length; i++) {
			var panopticon = panoptica[i];

			panopticon[method].apply(panopticon, arguments);
		}
	};
}

// Sampler exposed methods which map to panopticon methods.
panopticonMethods.forEach(exposePanopticonMethod);


/**
 * Register a new logger type with Panopticon, and expose the method on this module to forward data
 * to panoptica.
 *
 * @param {String}   name              New logger name.
 * @param {Function} loggerConstructor A constructor conforming to the Panopticon logger API.
 * @param {Function} [validator]       An optional validator function.
 */

exports.registerMethod = function (name, loggerConstructor, validator) {
	// Register the new logger method with Panopticon.
	Panopticon.registerMethod(name, loggerConstructor, validator);

	// Expose the new logger method on this module.
	exposePanopticonMethod(name);
};


/**
 * A custom panopticon transformer function. This mutates datasets into a format that is more useful
 * to observium.
 *
 * @param  {Object} data A panopticon data aggregate.
 * @param  {String} id   The ID of a cluster member.
 * @return {Object}      Mutated data.
 */

function transformer(data, id) {
	function checkValue(obj) {
		if (!obj || typeof obj !== 'object') {
			return;
		}

		var keys = Object.keys(obj);

		if (keys.indexOf('value') !== -1) {
			obj.values = {};
			obj.values[id] = obj.value;
			delete obj.value;
			return;
		}

		for (var i = 0; i < keys.length; i++) {
			checkValue(obj[keys[i]]);
		}
	}

	checkValue(data);

	return data;
}


/**
 * This function is called when a panopticon emits a data set. It updates the buffer, and emits
 * the events `'panopticonDelivery'`, which forwards the panopticon data set, and `'updatedData'`,
 * which emits all data together.
 *
 * @param {Object} data A panopticon data set.
 */

function delivery(data) {
	var name = data.name;
	var bufferLength = mage.core.config.get(['sampler', 'bufferLength']);

	if (!bufferedData[name]) {
		bufferedData[name] = [data];
	} else {
		bufferedData[name].push(data);
	}

	// Maintain a maximum buffer length for each panopticon.
	bufferedData[name].splice(0, bufferedData[name].length - bufferLength);

	// Update the gatheredData object with the new data for this panopticon.
	gatheredData[name] = data;

	// This emission contains data for this panopticon only, and the name as an argument.
	exports.emit('panopticonDelivery', data);

	// This emission fires for every delivery, and contains the complete data across all
	// panoptica. This means that data may appear to be repeated (unless you check time
	// stamps of course).
	exports.emit('updatedData', gatheredData);
}


/**
 * Process a url string into a path array.
 *
 * @param  {String}   urlString A url string.
 * @return {String[]} A array with elements that are sub-paths of increasing depth to index.
 */

function urlToPath(urlString) {
	var parsed = url.parse(urlString);

	if (!parsed.hasOwnProperty('pathname')) {
		return;
	}

	var path = parsed.pathname.split('/');

	// Remove the useless '' (zeroth) element and the 'sampler' (first) element.

	var samplerPos = path.indexOf('sampler');
	if (samplerPos !== -1) {
		path = path.slice(samplerPos + 1);
	}

	// If the request had a trailing '/', remove the resulting empty final element in the path.
	if (path[path.length - 1] === '') {
		path.pop();
	}

	return path;
}


/**
 * A simple HTTP request-response handler to wrap exports.query.
 *
 * @param {http.ClientRequest}  req HTTP client request object.
 * @param {http.ServerResponse} res HTTP server response object.
 */

function requestResponseHandler(req, res) {
	var data = exports.query(urlToPath(req.url));

	if (data instanceof Error) {
		res.writeHead(404, {});
		res.end();
	} else {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(data, null, '  '));
	}
}


/**
 * A websocket connection handler.
 *
 * @param {ws.WebSocket} connection A websocket connection object.
 */

function websocketHandler(connection) {
	logger.debug('Websocket connection for statistics was opened.');

	// If there is an error, log it and close the connection.
	function closeOnError(error) {
		if (error) {
			logger.error('Websocket client connection closed with error', error);
		}

		try {
			connection.close();
		} catch (e) {
			logger.error('Websocket failed to close', e);
		}
	}

	// Make a function that can send data sets with this connection.
	function sendToClient(dataSet) {
		var toSend = JSON.stringify({
			type: 'dataSet',
			content: dataSet
		});

		connection.send(toSend, closeOnError);
	}

	// Register an event listener for new data.
	exports.on('panopticonDelivery', sendToClient);

	// Log the connection closure, and remove the event listener for new data.
	connection.once('close', function () {
		logger.debug('WebSocket connection for sampler was closed.');

		exports.removeListener('panopticonDelivery', sendToClient);
	});

	// The client may request the data buffer.
	connection.on('message', function (message) {
		if (message === 'sendBufferedData') {
			var toSend = JSON.stringify({
				type: 'buffered',
				content: bufferedData
			});

			connection.send(toSend, closeOnError);
		}
	});
}


/**
 * Reads the config file for sampler configuration. Based on this it spawns panoptica.
 *
 * @param {Function} cb Callback function.
 */

exports.setup = function (cb) {
	// We need some initialisation data from config.
	var init = mage.core.config.get(['sampler']);
	var error;

	// If no intervals are given, skip the rest.
	if (!init || !init.intervals) {
		logger.debug('No intervals have been set up for sampler, skipping setup.');

		return cb();
	}

	// If there is configuration, but the intervals is not an object, then something was wrong.
	if (typeof init.intervals !== 'object') {
		error = new Error('Configuration "sampler.intervals" should resolve to an object.');
		logger.error.data('sampler.intervals', init.intervals).log(error);

		return cb(error);
	}

	var intervalNames = Object.keys(init.intervals);

	// If configuration exists, but the length of the intervals array is zero, skip the rest.
	if (intervalNames.length === 0) {
		logger.debug('No intervals have been set up for sampler, skipping setup.');

		return cb();
	}

	// This runs once. Are all the intervals finite numbers?
	var allFinite = intervalNames.every(function (name) {
		return Number.isFinite(init.intervals[name]);
	});

	if (!allFinite) {
		error = new Error('Interval values must be finite numbers.');
		logger.error.data('sampler.intervals', init.intervals).log(error);

		return cb(error);
	}

	// Panopticon reports in milliseconds by default. We want seconds, so we pass in a scale factor.
	var scaleFactor = 1000;

	// Once a sampler has submitted a log, we want it to be reset, not deleted between intervals.
	var persist = true;

	// Get the cluster start time. This is used to normalise the panoptica timings.
	var tStart = processManager.startTime;


	// Construct each panopticon and append it into the panoptica array.
	intervalNames.forEach(function (name) {
		var interval = init.intervals[name];

		// Create a new panopticon instance.
		var panopticon = new Panopticon(tStart, name, interval, scaleFactor, persist, transformer);

		// If the configuration indicates that Mage samples should be taken, we set this up here.
		if (init.sampleMage) {
			mageSamplers.setupEventCounters(panopticon);
			mageSamplers.perIntervalSets(panopticon);
		}

		// Listen for deliveries from this panopticon.
		panopticon.on('delivery', delivery);

		panoptica.push(panopticon);

		// This emission fires every time a panoptica is setup and registered to the sampler
		exports.emit('panopticonRegistered', panopticon);
	});


	// Each panopticon involves node timers. Upon MAGE shutdown these need to be dealt with.
	mage.once('shutdown', function () {
		for (var i = 0; i < panoptica.length; i++) {
			panoptica[i].stop();
		}

		exports.removeAllListeners();
	});

	cb();
};


/**
 * Add routes to host the gathered data
 *
 * @param {Function} cb Callback function.
 */

exports.expose = function (cb) {
	// A route for Observium and other services to query the gathered data with an HTTP request.
	mage.core.savvy.addRoute(SAVVY_ROUTE, requestResponseHandler);

	// A websocket for real time communication with the dashboard.
	mage.core.savvy.addWebSocketRoute(SAVVY_ROUTE, websocketHandler);

	cb();
};

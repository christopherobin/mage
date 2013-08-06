var nextTick = require('next-tick');

// Set bot module pre shared key

var psk;

var pskMatch = window.location.hash.substring(1).match(/psk=([^&]+)/);
if (pskMatch) {
	psk = pskMatch[1];
}

// augment user commands with the PSK

exports.createBotPlayer = function (options, cb) {
	exports.pskCreateBotPlayer(psk, options, cb);
};

exports.startBotSession = function (actorId, options, cb) {
	exports.pskStartBotSession(psk, actorId, options, cb);
};

// Data variables

var scenarios = {};


/**
 * Function which registers a new bot scenario
 *
 * @param {String}      name        Unique identifier for scenario
 * @param {Function}    fn          Function to be run when run scenario is called
 * @param {Function}    condition   Function which returns a true or false value. This is where
 *                                  you would put you special logic to determine whether or not
 *                                  this scenario should run.
 */
exports.addScenario = function (name, fn, condition) {
	scenarios[name] = { fn: fn, condition: condition };
};


function runScenario(name, options, delay, cb) {
	var scenario = scenarios[name];

	if (!scenario.condition(options)) {
		console.log('Condition not met for scenario:', name);
		return nextTick(cb);
	}

	function run() {
		console.log('Running scenario:', name);

		scenario.fn(options, cb);
	}

	if (delay === 0) {
		nextTick(run);
	} else {
		window.setTimeout(run, delay);
	}
}


function repeatScenario(name, options, delay, repetitions, cb) {
	if (repetitions < 1) {
		return cb();
	}

	runScenario(name, options, delay, function () {
		repeatScenario(name, options, delay, repetitions - 1, cb);
	});
}


/**
 * Run a set of scenarios with given options.
 *
 * @param {Array}       scenarioList    A list of scenarios and options to run
 * @param {Object}      options         A list of global options which apply to all scenarios
 * @param {Function}    cb              Callback to call upon completion
 *
 * Global Options:
 *      delay: How long to wait before executing scenario
 *
 * Scenario Options:
 *      delay: How long to wait before executing scenario
 *    options: Options to pass along to the scenario function and condition
 */

exports.runScenarios = function (scenarioList, options, cb) {
	options = options || {};
	scenarioList = scenarioList || [];

	// Copy scenarioList, so we can shift from it without being destructive.

	var scenarioListCpy = scenarioList.slice();

	// Will run scenarios in the order they were provided

	function nextScenario() {
		var scenario = scenarioListCpy.shift();

		if (!scenario) {
			return cb();
		}

		repeatScenario(
			scenario.name,
			scenario.options,
			scenario.delay || options.delay || 0,  // TODO: this logic is flawed
			scenario.repetitions || 1,
			nextScenario
		);
	}

	nextScenario();
};


/**
 * Repeat a list of scenarios for as long as the condition holds. The
 * condition is a function returns a true of false value.
 *
 * @param {Array}       scenarioList    Scenario list to be passed to runScenario
 * @param {Object}      options         Options to be passed to runScenario
 * @param {Function}    condition       Function which returns a true or false value. This is
 *                                      where you would put your loop exit logic
 * @param {Function}    cb              Callback to call upon loop exit
 */
exports.repeatScenarios = function (scenarioList, options, condition, cb) {
	if (!condition()) {
		return cb();
	}

	console.time('repeatScenarios');

	exports.runScenarios(scenarioList, options, function () {
		console.timeEnd('repeatScenarios');

		exports.repeatScenarios(scenarioList, options, condition, cb);
	});
};

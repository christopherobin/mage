(function (window) {
	// Load external dependencies to local variables
	var mage = window.mage;


	// Initialize bot module client
	var mod = mage.registerModule($html5client('module.bot.construct'));
		
	// Set bot module pre shared key
	var pskMatch = window.location.hash.substring(1).match(/psk=([^&]+)/) || [];
	mod.psk = pskMatch[1] || '';

	// Register bot.psk hook function
	mage.io.registerCommandHook('bot.psk', function () {
		return { key: mod.psk };
	});


	// Data variables
	var scenarios = [];


	/* Function which registers a new bot scenario
	 *
	 * Function Arguments:
	 *       name: Unique identifier for scenario
	 *     weight: ???
	 *         fn: Function to be run when run scenario is called
	 *  condition: Function which returns a true or false value. This is where
	 *             you would put you special logic to determine whether or not
	 *             this scenario should run.
	 */
	mod.addScenario = function (name, fn, condition) {
		scenarios[name] = {fn: fn, condition: condition};
	};


	/*
	 * Run a set of scenarios with given options.
	 *
	 * Function Arguments:
	 *   scenarioList: A list of scenarios and option to run
	 *        options: A list of global options which apply to all scenarios
	 *             cb: Callback to call upon completion
	 *
	 * Global Options:
	 *      delay: How long to wait before executing scenario
	 *
	 * Scenario Options:
	 *      delay: How long to wait before executing scenario
	 *    options: Options to pass along to the scenario function and condition
	 */
	mod.runScenarios = function (scenarioList, options, cb) {
		// Ensure options is an object
		options = options || {};

		// Ensure scenarioList is an array
		scenarioList = scenarioList || [];

		// Copy scenarioList to a new array, as this is passed over by reference
		var scenarioListCpy = scenarioList.slice(0);

		// Will run scenarios in the order they were provided
		var loopScenarios = function loopScenarios(callback) {
			if (scenarioListCpy.length === 0) {
				callback();
			} else {
				var scenario = scenarioListCpy.shift();
				var delay = scenario.delay || options.delay || 0;


				// Check if repetitions option set
				var repetitions = scenario.repetitions || 0;

				if (repetitions > 1) {
					delete scenario.repetitions;

					mod.repeatScenarios([scenario], options, function () {
						if (repetitions > 0) {
							repetitions--;
							return true;
						} else {
							return false;
						}
					}, function () {
						// Continue with the loop
						loopScenarios(callback);
					});

					return;
				}


				// Check if the scenario is eligible to run
				if (scenarios[scenario.name].condition(scenario.options)) {
					window.helpers.setTimeout(function () {
						console.log('Running scenario: ' + scenario.name);
						scenarios[scenario.name].fn(scenario.options, function (error) {
							// Catch errors and trickle them back
							if (error) {
								return callback(error);
							}

							// Continue with the loop
							loopScenarios(callback);
						});
					}, delay);
				} else {
					console.log('Condition not met for scenario: ' + scenario.name);
					return loopScenarios(callback);
				}
			}
		};

		loopScenarios(cb);
	};


	/*
	 * Repeat a list of scenarios for as long as the condition holds. The
	 * condition is a function returns a true of false value.
	 *
	 * Function Arguments:
	 *   scenarioList: Scenario list to be passed to runScenario
	 *        options: Options to be passed to runScenario
	 *      condition: Function which returns a true or false value. This is
	 *                 where you would put your loop exit logic
	 *             cb: Callback to call upon loop exit
	 */
	mod.repeatScenarios = function (scenarioList, options, condition, cb) {
		if (!condition()) {
			cb();
		} else {
			mod.runScenarios(scenarioList, options, function () {
				mod.repeatScenarios(scenarioList, options, condition, cb);
			});
		}
	};
}(window));
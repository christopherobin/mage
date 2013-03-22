var mage = require('./mage');
var logger = mage.core.logger.context('deprecated');


var handlers = {};
var addUseModuleWarned = false;


exports.trigger = function (name) {
	var handler = handlers[name];

	if (handler) {
		handler();
	} else {
		logger.alert('Failed to describe deprecation of:', name);
	}
};


handlers.logger = function () {
	var example = {
		logging: {
			html5: {
				console: {
					channels: [">=debug"]
				},
				server: {
					channels: [">=critical"]
				}
			},
			server: {
				terminal: {
					channels: [">=info"],
					config: {
						jsonIndent: 2,
						theme: "default",
						comments:  "jsonIndent sets the indentation of the json object logged in data() log calls (see documentation)",
						comments2: "two new themes available: dark and light"
					}
				},
				file: {
					channels: ["<info", ">=critical", "error"],
					config: {
						jsonIndent: 2,
						path: "./logs/",
						mode: "0600",
						comments:  "jsonIndent sets the indentation of the json object logged in data() log calls (see documentation)"
					}
				},
				graylog: {
					channels: [">=info"],
					config: {
						servers: [
							{ host: "192.168.100.85", port: 12201 },
							{ host: "192.168.100.86", port: 12201 }
						],
						facility: "Application identifier"
					}
				},
				websocket: {
					"does not take a channel argument": false,
					config: {
						port: 31337,
						comment: "this can listen only on net ports, not on socket files - the port accepts websocket conections"
					}
				},
				loggly: {
					channels: [">=info"],
					config: {
						token: "token, see loggly indication on web interface account login",
						subdomain: "subdomain"
					}
				}
			}
		}
	};

	logger.emergency
		.details('An example of an accurate configuration is available in the following JSON structure.')
		.details('Please take note that some of those variables are optional.')
		.data(example)
		.log('Invalid log configuration found.');
};

function addUseModule() {
	if (addUseModuleWarned) {
		return;
	}

	addUseModuleWarned = true;

	var example = "\nexample:\n\nvar mage = require('mage');\nmage.addModulesPath('./lib/modules');\nmage.useModules('session', 'assets', 'missions', ...);";

	logger.emergency
		.details('addModule and useModule are now deprecated!\n')
		.details('Please use addModulesPath to tell mage where your modules are,')
		.details('and useModules to add both mage modules and game modules.')
		.details('Note: useModules takes any number of module names as arguments.')
		.details(example)
		.log('Deprecated mage method.');
}

handlers.useModule = addUseModule;

handlers.addModule = addUseModule;

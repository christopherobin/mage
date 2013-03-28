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
	logger.emergency
		.details('An example of an accurate configuration is described in mage/lib/modules/logger/README.md')
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

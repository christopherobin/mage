var mage = require('../mage');

// list available engine types
var engineTypes = ['mdns', 'zookeeper'];

// this is our service, we don't need to create a new one everytime someone call createService()
var service;

// default configuration
var defaultConfig = {
	engine: 'mdns',
	options: {}
};

var serviceConfig;
/**
 * Instantiate the service discovery engine and return a light wrapper around the service type the user wants to
 * announce/browse.
 *
 * @param {string} name The name of the service (used for filtering)
 * @param {string} type The type of service (TCP, UDP, etc...)
 * @returns {Service}
 */
function createService(name, type) {
	if (service === undefined) {
		serviceConfig = mage.core.config.get(['server', 'serviceDiscovery']) || defaultConfig;
		var engine = serviceConfig.engine;

		if (engineTypes.indexOf(engine) === -1) {
			throw new Error('Invalid engine provided for serviceDiscovery');
		}

		// create service using given engine
		try {
			service = require('./engines/' + engine);
		} catch (error) {
			throw new Error('Couldn\'t create serviceDiscovery engine');
		}
	}

	return service.setup(name, type, serviceConfig.options);
}

exports.createService = createService;
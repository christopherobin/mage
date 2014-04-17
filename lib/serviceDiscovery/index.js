var path = require('path');
var mage = require('../mage');

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

// this is our service, we don't need to create a new one everytime someone call createService()

var service;
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
	if (!service) {
		serviceConfig = mage.core.config.get(['server', 'serviceDiscovery']);

		var engine = serviceConfig.engine;

		// create service using given engine
		try {
			service = require('./engines/' + engine);
		} catch (error) {
			throw new Error('Couldn\'t create serviceDiscovery engine \'' + engine + '\'');
		}
	}

	return service.setup(name, type, serviceConfig.options);
}

exports.createService = createService;

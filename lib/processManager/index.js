/**
 * This file wraps the processManager library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var path = require('path');
var mage = require('../mage');
var logger = mage.core.logger.context('processManager');

var processManager = require('./processManager');

// Set library defaults.
mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

// Pass the needed components into the state library for normal mage use.
processManager.initialize(mage, logger);

// Proxy the exports of state onto this library.
module.exports = processManager;
/**
 * This file wraps the sampler library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('sampler');
var processManager = require('../processManager');

var sampler = require('./sampler');

// Set library defaults.
mage.core.config.setTopLevelDefault('sampler', require('./default.json'));

// Pass the needed components into the sampler library for normal mage use.
sampler.passDependencies(mage, logger, processManager);

// Proxy the exports of state onto this module. Note that this makes this module an event emitter!
module.exports = sampler;
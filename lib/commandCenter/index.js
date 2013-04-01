/**
 * This file wraps the commandCenter library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('commandCenter');

var commandCenter = require('./commandCenter');

// Pass the needed components into the state library for normal mage use.
commandCenter.passDependencies(mage, logger);

// Proxy the exports of state onto this library.
module.exports = commandCenter;
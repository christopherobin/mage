/**
 * This file wraps the deprecator library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger  = mage.core.logger.context('deprecated');

var deprecator = require('./deprecator');

// Pass the needed components into the state library for normal mage use.
deprecator.passDependencies(logger);

// Proxy the exports of state onto this library.
module.exports = deprecator;
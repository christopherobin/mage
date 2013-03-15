/**
 * This file wraps the helper library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger  = mage.core.logger;

var helper = require('./helper');

// Pass the needed components into the state library for normal mage use.
helper.passDependencies(logger);

// Proxy the exports of state onto this library.
module.exports = helper;
/**
 * This file wraps the config library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var helpers = require('../helpers');

var config = require('./config');

// Pass the needed components into the state library for normal mage use.
config.passDependencies(helpers);

// Proxy the exports of state onto this library.
module.exports = config;
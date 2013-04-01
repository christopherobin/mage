/**
 * This file wraps the propertyMap library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('propertyMap');
var dataTypes = require('../datatypes');

var propertyMap = require('./propertyMap');

// Pass the needed components into the state library for normal mage use.
propertyMap.passDependencies(logger, dataTypes);

// Proxy the exports of state onto this library.
module.exports = propertyMap;
/**
 * This file wraps the livePropertyMap library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('livePropertyMap');
var dataTypes = require('../dataTypes');

var livePropertyMap = require('./livePropertyMap');

// Pass the needed components into the state library for normal mage use.
livePropertyMap.passDependencies(logger, dataTypes);

// Proxy the exports of state onto this library.
module.exports = livePropertyMap;
/** @module  mage */
require('./require');

var config = require('../config');
var Mage = require('./Mage');

var mage = module.exports = new Mage(config);

mage.setupCoreLibs();

// first do a daemon check

require('../daemon');

// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent

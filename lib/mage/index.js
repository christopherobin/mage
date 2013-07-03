/** @module  mage */

// Patch the require for json files. If a json file is badly formed then put it through jsonlint.
require('./require');

// Load the config library. This is passed into the Mage constructor, so we may make custom config
// objects when we need to test Mage instances.

// first disable the creation of runtime.json
process.env.NODE_CONFIG_DISABLE_FILE_WATCH = 'Y';

var config = require('../config');

// Load the mage constructor.
var Mage = require('./Mage');

// Mage a mage instance with the loaded configuration, and assign it as the module.exports.
var mage = module.exports = new Mage(config);
mage.setupCoreLibs();

// Load the daemon.
require('../daemon');

// Global default settings override.
require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent

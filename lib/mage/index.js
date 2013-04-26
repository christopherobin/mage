/** @module  mage */
var path = require('path');
var fs = require('fs');

// Patch the require for json files. If a json file is badly formed then put it through jsonlint.
require('./require');

// Remove the node-config runtime.json file if it exists.
try {
	fs.unlinkSync(path.join(process.env.NODE_CONFIG_RUNTIME_JSON || './config', 'runtime.json'));
} catch (e) {}

// Load the config library. This is passed into the Mage constructor, so we may make custom config
// objects when we need to test Mage instances.
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

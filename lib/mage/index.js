/** @module  mage */

var cluster = require('cluster');
var Mage = require('./Mage');

// Mage a mage instance with the loaded configuration, and assign it as the module.exports.

var mage = module.exports = new Mage();
mage.setupCoreLibs();

// Take care of startup arguments

var cli = require('./cli');

// If we're a master process, we're either the process managing the daemonization, or we are the
// process that is being daemonized (but never a worker).

var daemon;

if (cluster.isMaster) {
	daemon = require('../daemon');

	cli.enableDaemon(daemon);
}

// Parse and apply arguments

cli.run();

// If we're not busy daemonizing the app at this point, there was no request for daemonization. In
// case we are the process that is being daemonized, we will still want to be able to report to our
// commander, so we set that up now.

if (daemon) {
	daemon.appMaster();
}

// Global default settings override.

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent

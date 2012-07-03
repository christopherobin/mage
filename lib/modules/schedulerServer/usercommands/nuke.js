"use strict";

var schedulerServer = require('../../schedulerServer');

exports.params = [];
exports.execute = schedulerServer.nuke.bind(schedulerServer);

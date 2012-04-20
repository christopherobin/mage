"use strict";

var schedulerServer = require('../../schedulerServer');

exports.params = [];
exports.execute = schedulerServer.reload.bind(schedulerServer);

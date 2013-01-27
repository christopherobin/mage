"use strict";

var schedulerServer = require('../../schedulerServer');

exports.params = ['client', 'taskName', 'schedule', 'data'];
exports.execute = schedulerServer.scheduleCommand.bind(schedulerServer);

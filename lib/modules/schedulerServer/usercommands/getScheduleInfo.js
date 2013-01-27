"use strict";

var schedulerServer = require('../../schedulerServer');

exports.params = ['scheduleKey'];
exports.execute = schedulerServer.getScheduleInfo.bind(schedulerServer);

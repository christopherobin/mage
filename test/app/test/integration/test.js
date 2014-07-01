var system = require('system');
var address = system.args[1];
var phantomMocha = require('../harness');

phantomMocha.test(address + '/app/test', phantomMocha.exit);

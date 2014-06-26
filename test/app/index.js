var test = require('./test');

test.before();

var app = require('./lib');

test.start(app);

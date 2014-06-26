var test = require('./test');

test.before();

var app;

try {
	console.log(require.resolve('./lib'));
	app = require('./lib');
} catch (e) {
	console.error(e);
	test.after();
	console.error('Error requiring app.');
	process.exit(1);
}

test.start(app);

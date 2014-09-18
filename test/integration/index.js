process.chdir(__dirname);

var test = require('./test');

test.before();

var app;

try {
	app = require('./lib');
} catch (e) {
	test.after();
	console.error('Error requiring app:', e);
	process.exit(1);
}

app.mage.on('shutdown', test.after);

test.start(app);

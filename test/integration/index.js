process.chdir(__dirname);

var tester = require('./test');

tester.before();

var app;

try {
	app = require('./lib');
} catch (e) {
	tester.after();
	console.error('Error requiring app:', e);
	process.exit(1);
}

app.mage.on('shutdown', tester.after);

tester.start(app);

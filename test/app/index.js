var test = require('./test');

test.before();

var project;

try {
	project = require('./lib');
} catch (e) {
	test.after();
	console.error('Error requiring app:', e);
	process.exit(1);
}

project.mage.on('shutdown', test.after);

project.setup(project.start);

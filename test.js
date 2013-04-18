/**
 * The test engine module (placeholder).
 *
 * We don't mind this being synchronous.
 */

var fs = require('fs');
var path = require('path');
var Mocha = require('mocha');

var contents;

function listInPath(route) {
	return fs.readdirSync(route).map(function (partialPath) {
		return path.join(route, partialPath);
	}).sort();
}

contents = listInPath('./lib');
contents = contents.concat(listInPath('./lib/modules'));

// Filter out hidden stuff and non-directories, then sort lexigraphically.
var contentPath = contents.reduce(function (stack, item) {
	// Ignore hidden.
	if (item[0] === '.') {
		return stack;
	}

	// Ignore things that aren't directories.
	if (!fs.statSync(item).isDirectory()) {
		return stack;
	}

	// Check for test files and subdirectories.
	var testDir = path.join(item, 'test');
	var testFile = path.join(item, 'test.js');

	// If there is a test directory, then we add all the valid files in the directory to the stack.
	if (fs.existsSync(testDir)) {
		return stack.concat(fs.readdirSync(testDir).reduce(function (stack, file) {
			return path.extname(file) === '.js' ? stack.concat(path.join(testDir, file)) : stack;
		}, []));
	}

	// If there is a test file, just add the file to the stack.
	if (fs.existsSync(testFile)) {
		return stack.concat(testFile);
	}

	return stack;
}, []);

console.log('stack:', contentPath);

var mocha = new Mocha();
mocha.reporter('spec');

contentPath.forEach(function (testModule) {
	mocha.addFile(testModule);
});

// The exit status is the number of test failures.
mocha.run(process.exit);



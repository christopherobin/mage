/**
 * The test engine module (placeholder).
 *
 * We don't mind this being synchronous.
 */

var fs = require('fs');
var path = require('path');
var Mocha = require('mocha');

var contents;

try {
	contents = fs.readdirSync('./lib');
	contents.concat(fs.readdirSync('./lib/modules'));
} catch (e) {
	console.log(e.stack || e.message);
	return process.exit(1);
}

contents.sort();

// Filter out hidden stuff and non-directories, then sort lexigraphically.
var contentPath = contents.reduce(function (stack, item) {
	// Ignore hidden.
	if (item[0] === '.') {
		return stack;
	}

	// Ignore this directory.
	if (item === 'testEngine') {
		return stack;
	}

	// Resolve an absolute path.
	var resolvedPath = path.join(path.resolve('./lib'), item);

	// Ignore things that aren't directories.
	if (!fs.statSync(resolvedPath).isDirectory()) {
		return stack;
	}

	// Check for test files and subdirectories.
	var testDir = path.join(resolvedPath, 'test');
	var testFile = path.join(resolvedPath, 'test.js');

	// If there is a test directory.
	if (fs.existsSync(testDir)) {

		// If there is an index file, then this is a module and the directory is added to the stack.
		if (fs.existsSync(path.join(testDir, 'index.js'))) {
			return stack.concat(testDir);
		}

		// If there is no index file, then we add all the files in the directory to the stack.
		return stack.concat(fs.readdirSync(testDir).map(function (file) {
			return path.join(testDir, file);
		}));
	}

	// If there is a test file, just add the file to the stack.
	if (fs.existsSync(testFile)) {
		return stack.concat(testFile);
	}

	return stack;
}, []);

//console.log('stack:', contentPath);

var mocha = new Mocha();
mocha.reporter('spec');

contentPath.forEach(function (testModule) {
	mocha.addFile(testModule);
});

// The exit status is the number of test failures.
mocha.run(process.exit);



/**
 * The test engine module (placeholder).
 *
 * We don't mind this being synchronous.
 */

var fs = require('fs');
var path = require('path');

var contents;

try {
	contents = fs.readdirSync('./lib');
} catch (e) {
	console.log(e.stack || e.message);
	return process.exit(1);
}

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

	// Check for test subdirectories and keep the folders with them.
	var testDir = path.join(resolvedPath, 'test');
	var testFile = path.join(resolvedPath, 'test.js');

	if (fs.existsSync(testDir)) {
		return stack.concat(testDir);
	}

	if (fs.existsSync(testFile)) {
		return stack.concat(testFile);
	}

	return stack;
}, []).sort();

console.log('stack:', contentPath);



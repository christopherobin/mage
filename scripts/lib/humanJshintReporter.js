/**
 * The default JSHint output is somewhat wasteful, and very bland, making it hard for a human to
 * parse. The following does IMO a better job and colors the output for you.
 *
 * Usage: When invoking jshint from the command line, point it to this file with the --reporter
 * flag. e.g.
 *
 * jshint someFile.js --config /path/to/config.cfg --reporter /path/to/jshintReporter.js
 */

var chalk = require('chalk');

/**
 * Generate a string of spaces num wide.
 *
 * @param  {Number} num Number of spaces in string.
 * @return {String}     String of spaces.
 */

function pad(num) {
	return (new Array(num + 1)).join(' ');
}

/**
 * Gather errors by filename into lists.
 *
 * @param  {Array}  data Array of jshint error objects.
 * @return {Object}      A map of file name against lists of errors for each file.
 */

function splitByFile(data) {
	var allData = {};

	for (var i = 0; i < data.length; i++) {
		var datum = data[i];

		if (!allData.hasOwnProperty(datum.file)) {
			allData[datum.file] = [];
		}

		allData[datum.file].push(datum.error);
	}

	return allData;
}


/**
 * JSHint reporter function
 *
 * @param {Array} data Array of JSHint error objects.
 */

exports.reporter = function (data) {
	if (data.length === 0) {
		return;
	}

	var splitUp = splitByFile(data);
	var fileNames = Object.keys(splitUp).sort();
	var numFiles = fileNames.length;

	fileNames.forEach(function (fileName) {
		console.log(chalk.blue.bold('Errors in file:'), fileName);

		// Sort by line number.

		var fileData = splitUp[fileName].sort(function (a, b) {
			return a.line - b.line;
		});

		var lineWidth = 0;
		var charWidth = 0;

		// Work out column alignment for this file.

		for (var i = 0; i < fileData.length; i++) {
			lineWidth = Math.max(('' + fileData[i].line).length, lineWidth);
			charWidth = Math.max(('' + fileData[i].character).length, charWidth);
		}

		// Print each error.

		for (var j = 0; j < fileData.length; j++) {
			var error = fileData[j];

			var lineString = error.line + pad(lineWidth - ('' + error.line).length);
			var charString = error.character + pad(charWidth - ('' + error.character).length);

			console.error('  line', chalk.green(lineString), 'char', chalk.green(charString) + ':', chalk.red(error.reason));
		}
	});

	console.log(chalk.red.bold(data.length + ' errors found in ' + numFiles + ' file' + (numFiles === 1 ? ':' : 's:')));

	fileNames.forEach(function (fileName) {
		console.log('  ' + fileName);
	});
};

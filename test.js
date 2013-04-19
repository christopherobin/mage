/**
 * The test engine module. The exit status is the number of test failures.
 */

var Mocha = require('mocha');
var Glob = require('glob').Glob;

var globStrings = ['./lib/*/test/*.js', './lib/*/test.js', './lib/modules/*/test/*.js', './lib/modules/*/test.js'];
var globsToFinish = globStrings.length;

var mocha = new Mocha();
mocha.reporter('spec');

function processMatch(filePath) {
	mocha.addFile(filePath);
}

function globComplete() {
	globsToFinish -= 1;

	if (globsToFinish) {
		return;
	}

	mocha.run(process.exit);
}

globStrings.forEach(function (globString) {
	new Glob(globString, {}).on('match', processMatch).once('end', globComplete);
});

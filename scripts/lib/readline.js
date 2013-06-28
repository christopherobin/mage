var readline = require('readline');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

exports.ask = function (question, defaultValue, cb) {
	if (defaultValue) {
		question += ' (' + defaultValue + ')';
	}

	rl.question(question + ' ', function (answer) {
		if (answer) {
			answer = answer.trim();
		}

		cb(answer || defaultValue || '');
	});
};

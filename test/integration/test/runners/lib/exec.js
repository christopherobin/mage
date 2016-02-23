var spawn = require('child_process').spawn;


function exec(filePath, args, options, cb) {
	options = options || {};

	var proc = spawn(filePath, args, { stdio: 'inherit', env: options.env || process.env });
	var timer;

	proc.on('exit', function (code, signal) {
		clearTimeout(timer);

		if (code === 0) {
			return cb();
		}

		return cb(new Error('Execution failed: ' + (code || signal)));
	});

	if (options.timeout) {
		timer = setTimeout(function () {
			proc.kill('SIGKILL');
		}, options.timeout);
	}
}


module.exports = exec;

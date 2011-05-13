var errors = {
	ERROR_CONST: { module: 'manage', code: 1000, log: { msg: 'Manage error.', method: 'error' } }
};

exports.errors = errors;


exports.userCommands = {
	quit:           __dirname + '/usercommands/quit.js',
	getMemoryUsage: __dirname + '/usercommands/getMemoryUsage.js'
};


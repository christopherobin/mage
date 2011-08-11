var stream = require('stream'),
	fs = require('fs');
//var util = require('util'); util.inspect() is nice, but doesn't go deep into objects


exports.info = exports.error = exports.debug = function () {};


exports.add = function (name, output) {
	exports[name] = function () {
		if (output instanceof stream.Stream) {
			var out = [];

			for (var i = 0, len = arguments.length; i < len; i++) {
				var obj = arguments[i];
				out.push(typeof obj === 'string' ? obj : JSON.stringify(obj));
			}

			var time = new Date();

			output.write(time.toJSON() + ' : ' + out.join(' ') + '\n', 'utf8');
		} else {
			switch (output)
			{
			case 'stdout':
				console.log.apply(this, arguments);
				break;

			case 'stderr':
				console.error.apply(this, arguments);
				break;
			}
		}
	};
};


exports.setup = function (cfg) {
	for (var name in cfg.log) {
		var output = cfg.log[name];

		if (output === 'file') {
			exports.add(name, fs.createWriteStream(cfg.logPath + '/' + name + '.log', { flags: 'a', encoding: 'utf8', mode: parseInt('0666', 8) }));
		} else {
			exports.add(name, output);
		}
	}

	process.on('uncaughtException', function (error) {
		exports.error(error.stack);
	});
};


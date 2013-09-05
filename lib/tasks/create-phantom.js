var fs = require('fs');
var pathJoin = require('path').join;


exports.setup = function (mage, options, cb) {
	mage.core.msgServer.setup(cb);
};


exports.start = function (mage, options, cb) {
	// replace some vars in it with config related values, and output it to stdout

	fs.readFile(pathJoin(__dirname, 'create-phantom.template.js'), 'utf8', function (error, data) {
		if (error) {
			console.error(error);
			return cb(error);
		}

		var re = /%([0-9A-Z\_]+)%/g;

		var vars = {
			APP_CLIENTHOST_EXPOSE: mage.core.msgServer.getHttpServer().getClientHostBaseUrl(),
			APP_NAME: options && options.app
		};

		data = data.replace(re, function (_, match) {
			return vars[match] || '';
		});

		process.stdout.write(data + '\n');

		cb(null, { shutdown: true });
	});
};

var fs = require('fs');
var pathJoin = require('path').join;


module.exports = function (app, file, mage) {
	// replace some vars in it with config related values, and output it to the given file path.

	fs.readFile(pathJoin(__dirname, 'create-phantom.template.js'), 'utf8', function (error, data) {
		if (error) {
			return mage.fatalError(error);
		}

		var re = /%([0-9A-Z\_]+)%/g;

		var vars = {
			FILENAME: file,
			APP_CLIENTHOST_EXPOSE: mage.core.msgServer.getHttpServer().getClientHostBaseUrl(),
			APP_NAME: app
		};

		data = data.replace(re, function (_, match) {
			return vars[match] || '';
		});

		fs.writeFile(file, data, function (error) {
			if (error) {
				return mage.fatalError(error);
			}

			mage.quit();
		});
	});
};

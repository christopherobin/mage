var mage = require('../../mage'),
    logger = mage.core.logger,
    BuildTarget = require('../buildTarget').BuildTarget,
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    helpers = mage.core.helpers;


function voidParser(filePath, data, cb) {
	cb(null, data);
}


exports.build = function (buildTarget, clientConfig, contextName, filePath, cb) {
	filePath = buildTarget.resolvePath(filePath);

	helpers.getFileContents(filePath, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data) {
			return cb(null, '');
		}

		// parse the file, if there is a parser for this extension

		var context = mage.core.app.contexts.get(contextName);
		if (!context) {
			logger.error('Context', contextName, 'not found.');
			return cb('badContext');
		}

		// find a required parser for this file type

		var parse = voidParser;

		// extract extension from filename

		var index = filePath.lastIndexOf('.');
		if (index !== -1) {
			var ext = filePath.substr(index + 1);

			var parser = context.getParser(ext);

			if (parser) {
				parse = parser;
			}
		}

		// if the context is "bin", we do not build filecontent

		if (context.name === 'bin') {
			parse(filePath, data, cb);
		} else {
			// build the content of the file

			var subTarget = new BuildTarget(buildTarget.app, 'filecontent', data, buildTarget.context);

			subTarget.rootPath = path.dirname(filePath);

			subTarget.build(clientConfig, function (error, output) {
				if (error) {
					return cb(error);
				}

				parse(filePath, output, cb);
			});
		}
	});
};


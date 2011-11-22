var mithril = require('../../mithril'),
    fs = require('fs'),
    async = require('async');

var helpers = mithril.core.helpers;

var fileContentBuilder = require('./fileContentBuilder');


exports.build = function (buildTarget, language, contextName, filePath, cb) {
	helpers.getFileContents(filePath, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data) {
			return cb();
		}

		// parse the file, if there is a parser for this extension

		var context = mithril.core.app.contexts.get(contextName);
		if (!context) {
			mithril.core.logger.error('Context', contextName, 'not found.');
			return cb('badContext');
		}

		// find a required parser for this file type

		var parser;

		// extract extension from filename

		var index = filePath.lastIndexOf('.');
		if (index !== -1) {
			var ext = filePath.substr(index + 1);

			parser = context.getParser(ext);
		}

		// build the content of the file

		fileContentBuilder.build(buildTarget, language, contextName, data, function (error, output) {
			if (error) {
				return cb(error);
			}

			if (parser) {
				parser(filePath, output, cb);
			} else {
				cb(null, output);
			}
		});
	});
};


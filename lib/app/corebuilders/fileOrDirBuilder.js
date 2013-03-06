var mage = require('../../mage'),
    logger = mage.core.logger,
    async = require('async'),
    fs = require('fs');


var fileBuilder = require('./fileBuilder');
var dirBuilder = require('./dirBuilder');


exports.build = function (buildTarget, clientConfig, contextName, filePath, cb) {
	fs.stat(filePath, function (error, stats) {
		if (error) {
			logger.error('Could not fs.stat:', filePath);
			return cb(error);
		}

		if (stats.isDirectory()) {
			return dirBuilder.build(buildTarget, clientConfig, contextName, filePath, cb);
		}

		if (stats.isFile()) {
			return fileBuilder.build(buildTarget, clientConfig, contextName, filePath, cb);
		}
		
		var errorPath = new Error('Given path is not a file or directory, ignoring: ' + filePath);
		
		logger.error(errorPath);
		
		return cb(errorPath);
	});
};

exports.buildList = function (buildTarget, clientConfig, contextName, filePaths, cb) {
	if (!Array.isArray(filePaths) || filePaths.length === 0) {
		return cb(null, '');
	}

	var context = mage.core.app.contexts.get(contextName);

	if (!context) {
		logger.error('Unrecognized context for fileOrDirBuilder.buildList');
		return cb('badContext');
	}

	async.mapSeries(
		filePaths,
		function (file, callback) {
			if (file && file.length) {
				return exports.build(buildTarget, clientConfig, contextName, file, callback);
			}

			return callback();
		},
		function (error, results) {
			if (error) {
				return cb(error);
			}

			return cb(null, results.join(context.fileGlue));
		}
	);
};

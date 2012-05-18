var mithril = require('../../mithril'),
    async = require('async'),
    fs = require('fs');


var fileBuilder = require('./fileBuilder');
var dirBuilder = require('./dirBuilder');


function build(buildTarget, clientConfig, contextName, filePath, cb) {
	fs.stat(filePath, function (error, stats) {
		if (error) {
			mithril.core.logger.error('Could not fs.stat:', filePath);
			return cb(error);
		}

		if (stats.isDirectory()) {
			dirBuilder.build(buildTarget, clientConfig, contextName, filePath, cb);
		} else if (stats.isFile()) {
			fileBuilder.build(buildTarget, clientConfig, contextName, filePath, cb);
		} else {
			mithril.core.logger.error('Given path is not a file or directory, ignoring:', filePath);
			cb('noFileOrDir');
		}
	});
}


exports.build = build;


exports.buildList = function (buildTarget, clientConfig, contextName, filePaths, cb) {
	if (!Array.isArray(filePaths) || filePaths.length === 0) {
		return cb(null, '');
	}

	var context = mithril.core.app.contexts.get(contextName);

	if (!context) {
		mithril.core.logger.error('Unrecognized context for fileOrDirBuilder.buildList');
		return cb('badContext');
	}

	async.mapSeries(
		filePaths,
		function (file, callback) {
			if (file && file.length > 0) {
				build(buildTarget, clientConfig, contextName, file, callback);
			} else {
				callback();
			}
		},
		function (error, results) {
			if (error) {
				cb(error);
			} else {
				cb(null, results.join(context.fileGlue));
			}
		}
	);
};


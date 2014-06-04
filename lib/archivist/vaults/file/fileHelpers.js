var path = require('path');
var fs = require('fs');
var async = require('async');


/**
 * Function which recursively attempts to purge subfolders starting at a given subfolderPath. It
 * will work its way backwards until it has reached the given root path. If there is an error during
 * directory removal, we just ignore it and call the callback.
 *
 * @param {String} rootPath - root path to which the given subfolder belongs
 * @param {String} subfolderPath - subfolder path relative to the root path
 * @param {String} logger
 * @param {Function} cb
 */
exports.purgeEmptyParentFolders = function (rootPath, subfolderPath, logger, cb) {
	var fullPath = path.join(rootPath, subfolderPath);

	// Don't delete if we have reached the base
	if (!subfolderPath || subfolderPath === '.') {
		return cb();
	}

	fs.rmdir(fullPath, function (error) {
		if (error) {
			return cb();
		}

		logger.verbose('Purged empty subfolder:', fullPath);

		return exports.purgeEmptyParentFolders(rootPath, path.dirname(subfolderPath), logger, cb);
	});
};


/**
 * Function which scans all subdirectories for a given root path and attempts to delete any empty
 * subfolders. It will traverse to the deepest child of each branch and work backwards deleting any
 * empty folders. If there is an error during directory removal, we just ignore it and call the
 * callback.
 *
 * @param {String} rootPath - root path for given subfolder path
 * @param {String} subfolderPath - internal recursion string (pass in null)
 * @param {String} logger
 * @param {Function} cb
 */
exports.purgeEmptySubFolders = function (rootPath, subfolderPath, logger, cb) {
	subfolderPath = subfolderPath || '';
	var fullPath = path.join(rootPath, subfolderPath);

	fs.readdir(fullPath, function (error, files) {
		if (error) {
			return cb();
		}

		async.eachSeries(files, function (file, callback) {
			var filepath = path.join(fullPath, file);
			fs.stat(filepath, function (error, stat) {
				if (error || !stat.isDirectory()) {
					return callback();
				}

				// Recurse inwards
				exports.purgeEmptySubFolders(rootPath, path.join(subfolderPath, file), logger, callback);
			});
		}, function () {
			// Do nothing if root path
			if (!subfolderPath) {
				return cb();
			}

			// Otherwise attempt to remove directory
			fs.rmdir(fullPath, function (error) {
				if (error) {
					return cb();
				}

				logger.verbose('Purged empty subfolder:', fullPath);

				return cb();
			});
		});
	});
};
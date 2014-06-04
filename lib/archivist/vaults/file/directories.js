var path = require('path');
var fs = require('fs');
var async = require('async');


/**
 * Recursively scans a directory for all files. This will then yield an array of all filenames
 * relative to the give rootPath.
 *
 * @param {Function} rootPath
 * @param {Function} cb
 */
exports.recursiveFileList = function (rootPath, cb) {
	var fileList = [];

	fs.readdir(rootPath, function (error, files) {
		if (error) {
			return cb(error);
		}

		async.eachSeries(files, function (filename, callback) {
			var filePath = path.join(rootPath, filename);
			fs.stat(filePath, function (error, stat) {
				if (error) {
					return callback(error);
				}

				// If not a directory then push onto list and continue
				if (!stat.isDirectory()) {
					fileList.push(filename);
					return callback();
				}

				// Otherwise recurse
				exports.recursiveFileList(filePath, function (error, childFileList) {
					if (error) {
						return callback(error);
					}

					// Append list of child file onto our file list
					for (var i = 0; i < childFileList.length; i += 1) {
						fileList.push(path.join(filename, childFileList[i]));
					}
					return callback();
				});
			});
		}, function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, fileList);
		});
	});
};
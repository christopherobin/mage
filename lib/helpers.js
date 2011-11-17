var fs = require('fs'),
    async = require('async'),
    mithril = require('./mithril');


exports.strChunks = function (str, delim, count) {
	// like string.split, except that it does not leave out the last part of the delimited result
	// eg: strSlice('a.b.c.d', '.', 2) returns: ['a', 'b.c.d.']

	str = str.split(delim);

	var last = str.splice(count - 1);
	if (last.length > 0) {
		return str.concat(last.join(delim));
	}

	return str;
};


exports.randomInteger = function (low, high) {
	low = ~~low;
	high = ~~high + 1;

	return low + ~~(Math.random() * (high - low));
};


exports.getFileContents = function (path, cb) {
	mithril.core.logger.debug('Loading contents from:', path);

	fs.readFile(path, 'utf8', function (error, data) {
		if (error) {
			mithril.core.logger.error('Error reading file contents:', path);
			return cb(error);
		}

		cb(null, data);
	});
};


exports.getFilesContents = function (paths, glue, cb) {
	if (typeof glue !== 'string') {
		glue = '';
	}

	async.mapSeries(
		paths,
		exports.getFileContents,
		function (error, parts) {
			if (error) {
				cb(error);
			} else {
				cb(null, parts.join(glue));
			}
		}
	);
};


exports.readDirectory = function (path, matcher, cb) {
	// returns: { files: [], directories: [] } containing relative paths

	fs.readdir(path, function (error, entries) {
		if (error) {
			mithril.core.logger.error('Error reading directory', path);
			return cb(error);
		}

		var result = { files: [], directories: [] };

		async.forEachSeries(
			entries,
			function (entry, callback) {
				// skip hidden files

				if (entry[0] === '.') {
					return callback();
				}

				var entryPath = path + '/' + entry;

				fs.stat(entryPath, function (error, stats) {
					if (error) {
						mithril.core.logger.error('Error reading directory entry', entryPath);
						return cb(error);
					}

					if (stats.isDirectory()) {
						result.directories.push(entry);
					} else if (stats.isFile()) {
						// skip files that do not match the matcher

						if (!matcher || entry.match(matcher)) {
							result.files.push(entry);
						}
					}

					callback();
				});
			},
			function (error) {
				if (error) {
					cb(error);
				} else {
					cb(null, result);
				}
			}
		);
	});
};


exports.getFilesRecursive = function (path, matcher, glue, cb) {
	mithril.core.logger.debug('Reading entire directory structure "' + path + '", using matcher: ' + matcher);

	if (typeof glue !== 'string') {
		glue = '';
	}

	readDirectory(path, matcher, function (error, entries) {
		if (error) {
			return cb(error);
		}

		var tasks = [];

		// first read files

		entries.files.forEach(function (file) {
			tasks.push(function (callback) {
				getFileContents(path + '/' + file, callback);
			});
		});

		// next, directories

		entries.directories.forEach(function (dir) {
			tasks.push(function (callback) {
				getFilesRecursive(path + '/' + dir, matcher, glue, callback);
			});
		});

		// execute the reads and return the glued together result

		async.series(
			tasks,
			function (error, contents) {
				if (error) {
					cb(error);
				} else {
					cb(null, contents.join(glue));
				}
			}
		);
	});
};


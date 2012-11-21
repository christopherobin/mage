var fs = require('fs'),
    async = require('async'),
    mithril = require('./mithril'),
	jsonlint = require('jsonlint'),
    logger = mithril.core.logger;


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
	low = parseInt(low, 10);
	high = parseInt(high, 10) + 1;

	return low + parseInt(Math.random() * (high - low), 10);
};


/* chooseWeighted(spec) returns one of the keys of the given spec,
*  randomly selected, based on each key's weight (the value).
*  returns null on error or if there's nothing to be chosen.
*/

exports.chooseWeighted = function (spec) {
	var randMax = 0, selection = [], entry, i, len, name, chance, rand;

	// sanitize the spec and calculate the total chance count (not necessarily 100)

	for (name in spec) {
		chance = parseInt(spec[name], 10);

		if (chance >= 0) {
			randMax += chance;
			selection.push({ name: name, chance: chance });
		}
	}

	len = selection.length;

	if (randMax < 1 || len < 1) {
		return null;
	}

	// if there is only 1 entry, we return it immediately

	if (len === 1) {
		return selection[0].name;
	}

	// pick a random entry, based on its chance

	rand = exports.randomInteger(1, randMax);
	for (i = 0; i < len; i += 1) {
		entry = selection[i];

		rand -= entry.chance;
		if (rand <= 0) {
			return entry.name;
		}
	}

	// this edge case should never happen, because rand will have always hit 0

	return null;
};


exports.timeCodeToSec = function (code) {
	// turns a time code into seconds:
	// "[num]d" days
	// "[num]h" hours
	// "[num]m" minutes
	// "[num]s" seconds
	// returns false if parsing failed

	var m;

	if ((m = code.match(/^([1-9][0-9]*)d$/))) {
		return ~~m[1] * 24 * 3600;
	}

	if ((m = code.match(/^([1-9][0-9]*)h$/))) {
		return ~~m[1] * 3600;
	}

	if ((m = code.match(/^([1-9][0-9]*)m$/))) {
		return ~~m[1] * 60;
	}

	if ((m = code.match(/^([1-9][0-9]*)s?$/))) {
		return ~~m[1];
	}

	return false;
};


exports.objToJson = function (o, add) {
	var key, out = [];

	for (key in o) {
		out.push('"' + key + '":' + JSON.stringify(o[key]));
	}

	for (key in add) {
		out.push('"' + key + '":' + add[key]);
	}

	return '{' + out.join(',') + '}';
};


exports.lintingJsonParse = function (json) {
	// returns undefined if unable to successfully parse,
	// and logs a lint-result to logChannelName or 'alert' if not given.

	var result;

	try {
		result = JSON.parse(json);
	} catch (error) {
		// slow parse which throws a descriptive error.message if it fails

		try {
			result = jsonlint.parse(json);
		} catch (lintError) {
			if (typeof lintError.message === 'string') {
				lintError.message = lintError.message.replace(/\t/g, ' ');
			}

			throw lintError;
		}
	}

	return result;
};


exports.deepCopy = function deepCopy(obj) {
	var out;

	if (Array.isArray(obj)) {
		var len = obj.length;

		out = new Array(len);

		for (var i = 0; i < len; i++) {
			out[i] = deepCopy(obj[i]);
		}
	} else if (obj && typeof obj === 'object') {
		out = {};

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				out[key] = deepCopy(obj[key]);
			}
		}
	} else {
		out = obj;
	}

	return out;
};


exports.getFileContents = function (path, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else {
		options = options || {};
	}

	logger.verbose('Loading contents from:', path);

	fs.readFile(path, options.encoding || 'utf8', function (error, data) {
		if (!options.optional && error) {
			logger.error('Error reading file contents:', path);
			return cb(error);
		}

		cb(null, data || null);
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
			logger.error('Error reading directory:', path);
			return cb(error);
		}

		entries.sort();

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
						logger.error('Error reading directory entry:', entryPath);
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
	logger.verbose('Reading entire directory structure', path, ' using matcher:', matcher);

	if (typeof glue !== 'string') {
		glue = '';
	}

	exports.readDirectory(path, matcher, function (error, entries) {
		if (error) {
			return cb(error);
		}

		var tasks = [];

		// first read files

		entries.files.forEach(function (file) {
			tasks.push(function (callback) {
				exports.getFileContents(path + '/' + file, callback);
			});
		});

		// next, directories

		entries.directories.forEach(function (dir) {
			tasks.push(function (callback) {
				exports.getFilesRecursive(path + '/' + dir, matcher, glue, callback);
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


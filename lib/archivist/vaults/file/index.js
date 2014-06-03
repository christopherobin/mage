// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

// NOTE: extension variables always contain the period as the first character

var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var async = require('async');
var Archive = require('./Archive');

var EXPIRE_MAX_PARALLEL = 20;


// export the defaultTopicApi

exports.defaultTopicApi = require('./defaultTopicApi');


// constants

var META_FILE_EXTENSION = '.filevault';


// helper functions

function safeExt(ext) {
	return ext[0] === '.' ? ext : '.' + ext;
}


function writeWithOptions(filePath, options, data, cb) {
	var stream;
	var bytes = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

	try {
		stream = fs.createWriteStream(filePath, options);
	} catch (error) {
		return cb(error);
	}

	function callback(error) {
		if (!error && stream.bytesWritten === bytes) {
			return cb();
		}

		// if the error was that exclusive mode failed due to the file already existing, we bail
		// out normally

		if (error && error.code === 'EEXIST') {
			return cb(error);
		}

		// else we consider this a failed file overwrite attempt, and we must remove the file

		return fs.unlink(filePath, function () {
			if (!error && stream.bytesWritten !== bytes) {
				error = new Error('Bytes written: ' + stream.bytesWritten + ' of ' + bytes);
			}

			return cb(error);
		});
	}

	stream.once('error', callback);
	stream.once('close', callback);

	stream.once('open', function () {
		stream.write(data);
		stream.end();
	});
}


function applyTTL(fileVault, filenameWithoutExt, expirationSeconds) {
	clearTimeout(fileVault._timers[filenameWithoutExt]);

	var now = Date.now();
	var expirationMilliseconds = expirationSeconds * 1000;

	if (!expirationSeconds || !fileVault.allowExpire || expirationMilliseconds < now) {
		delete fileVault._timers[filenameWithoutExt];
		return;
	}

	var ttl = expirationMilliseconds - now;

	fileVault._timers[filenameWithoutExt] = setTimeout(function expireByTimeout() {
		delete fileVault._timers[filenameWithoutExt];
		fileVault.optMeta(filenameWithoutExt, function () {});
	}, ttl);
}


function retryRead(filePath, logger, cb) {
	var attempts = 0;
	var retryLimit = 5;
	var retryDelay = 50;

	function attemptRead() {
		attempts += 1;

		if (attempts > 1) {
			logger.verbose('Retry attempt', attempts, 'to read from', filePath);
		}

		fs.readFile(filePath, function (error, data) {
			if (!error && (!data || data.length === 0)) {
				if (attempts <= retryLimit) {
					if (attempts === 1) {
						logger.warning('Could not read from file:', filePath, 'retrying', retryLimit, 'times every', retryDelay, 'msec');
					}

					return setTimeout(attemptRead, retryDelay);
				}
			}

			if (error) {
				return cb(error);
			}

			if (attempts > 1) {
				if (data && data.length > 0) {
					logger.debug('Succeeded to read', filePath, 'on attempt', attempts);
				} else {
					logger.debug('File', filePath, 'still empty after', attempts, 'attempts');
				}
			}

			cb(null, data);
		});
	}

	attemptRead();

}


// Vault wrapper around node's "fs" module

function FileVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.allowExpire = true;
	this.path = undefined;
	this.logger = logger;
	this._timers = {};
}


exports.create = function (name, logger) {
	return new FileVault(name, logger);
};


/**
 * Prepares the vault for use.
 *
 * @param {Object} cfg
 * @param {Function} cb
 */

FileVault.prototype.setup = function (cfg, cb) {
	if (cfg.disableExpiration) {
		this.archive.touch = undefined;
		this.allowExpire = false;
	}

	var filePath = this.path = path.resolve(cfg.path || './filevault');

	var logger = this.logger;
	var that = this;

	fs.stat(filePath, function (err, stats) {
		if (err) {
			if (err.code === 'ENOENT') {
				logger.warning('Path', filePath, 'not found, skipping value expiration.');
				return cb();
			}

			logger.emergency('Error while performing a stat on:', filePath, err);
			return cb(err);
		}

		if (!stats.isDirectory()) {
			logger.emergency('Path', filePath, 'is not a directory. Please check your vault configuration.');
			return cb(new Error('Path not a directory'));
		}

		that.checkMeta(cb);
	});
};


/**
 * Cleans up the vault so that node can shutdown gracefully.
 */

FileVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	for (var filenameWithoutExt in this._timers) {
		clearTimeout(this._timers[filenameWithoutExt]);
	}

	this._timers = {};
};


/**
 * Instantiates a fresh database based on the given configuration, which means instantiating the
 * folder to which this filevault will be writing its values.
 *
 * @param {Function} cb  Called upon completion.
 */

FileVault.prototype.createDatabase = function (cb) {
	var filePath = this.path;
	var logger = this.logger;

	fs.exists(filePath, function (exists) {
		if (exists) {
			logger.notice('Folder', filePath, 'already exists.');
			return cb();
		}

		logger.notice('Creating', filePath);

		mkdirp(filePath, cb);
	});
};


/**
 * Destroys the database (Use with caution!)
 *
 * @param {Function} cb  Called upon completion.
 */

FileVault.prototype.dropDatabase = function (cb) {
	var that = this;

	this.logger.notice('Cleaning up all values');

	// remove all documents

	this.scan(null, function (error, list) {
		if (error) {
			if (error.code === 'ENOENT') {
				return cb();
			}

			return cb(error);
		}

		async.eachSeries(
			list,
			function (entry, callback) {
				that.del(entry, callback);
			},
			function (error) {
				if (error) {
					return cb(error);
				}

				fs.rmdir(that.path, function (error) {
					if (error) {
						that.logger.warning(error);
					}

					return cb();
				});
			}
		);
	});
};


/**
 * Creates a full path to a meta file
 *
 * @param {string} filenameWithoutExt
 * @returns {string} full path to a meta file
 */

FileVault.prototype._createMetaPath = function (filenameWithoutExt) {
	return path.join(this.path, filenameWithoutExt) + META_FILE_EXTENSION;
};


/**
 * Creates a full path to a content file
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @returns {string} full path to a content file
 */

FileVault.prototype._createContentPath = function (filenameWithoutExt, ext) {
	return path.join(this.path, filenameWithoutExt) + safeExt(ext);
};


/**
 * Gets the parsed contents from a meta file.
 * Yields an error if the file does not exist or cannot be parsed.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.getMeta = function (filenameWithoutExt, cb) {
	var logger = this.logger;
	var filePath = this._createMetaPath(filenameWithoutExt);

	retryRead(filePath, logger, function (error, data) {
		if (!error && (!data || data.length === 0)) {
			error = new Error('File is empty');
		}

		if (error) {
			logger.alert('Could not read data from file:', filePath, error);
			return cb(error);
		}

		try {
			data = JSON.parse(data);
		} catch (parseError) {
			logger.alert('Failed to parse meta data:', data, 'from file:', filePath);
			return cb(parseError);
		}

		cb(null, data);
	});
};


/**
 * Gets the parsed contents from a meta file.
 * Yields an error if the file cannot be parsed. If the file does not exist or has expired,
 * undefined is returned.

 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.optMeta = function (filenameWithoutExt, cb) {
	var logger = this.logger;
	var filePath = this._createMetaPath(filenameWithoutExt);

	var that = this;

	retryRead(filePath, logger, function (error, data) {
		if (error) {
			// An error of non-existence is not an error to us, it would simply return the value
			// undefined.

			if (error.code === 'ENOENT') {
				logger.verbose('Optional meta file does not exist:', filePath);
				return cb(null, undefined);
			}

			logger.alert('Could not read data from meta file:', filePath, error);
			return cb(error);
		}

		// lingering empty meta files can happen if a create happened, but the data write was
		// prevented for some weird reason, we treat it as if the file doesn't exist

		if (!data || data.length === 0) {
			logger.verbose('Found an empty meta file:', filePath);
			return cb(null, undefined);
		}

		try {
			data = JSON.parse(data);
		} catch (parseError) {
			logger.alert('Failed to parse meta data:', data, 'from file:', filePath);
			return cb(parseError);
		}

		applyTTL(that, filenameWithoutExt, data.expirationTime);

		var now = Math.floor(Date.now() / 1000);

		if (!data.expirationTime || data.expirationTime > now) {
			return cb(null, data);
		}

		logger.verbose('File expired', now - data.expirationTime, 'seconds ago:', filePath);

		if (!that.allowExpire) {
			logger.verbose('Not returning data for expired file:', filePath);
			return cb(null, undefined);
		}

		logger.verbose('expire:', filePath);

		that.delMeta(filenameWithoutExt, function (error) {
			if (error) {
				return cb(error);
			}

			that.delContent(filenameWithoutExt, data.ext, cb);
		});

	});
};


/**
 * Function which creates any subfolders we need for a give filevault key.
 *
 * @param {String} key
 * @param {String} fullPath
 * @param {Function} cb
 */
function createKeyFolders(key, fullPath, cb) {
	// NOTE: We check after first character, since a leading slash will be omitted by path.join
	if (key.indexOf(path.sep) <= 0) {
		return cb();
	}

	mkdirp(path.dirname(fullPath), cb);
}


/**
 * Creates or overwrites a meta file. If the addOnly argument is true, it will only attempt to
 * create. Not overwrite.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} addOnly
 * @param {Object} addOperation
 * @param {Function} cb
 */

FileVault.prototype.writeMeta = function (filenameWithoutExt, meta, addOnly, cb) {
	var that = this;
	var filePath = this._createMetaPath(filenameWithoutExt);

	if (meta.expirationTime && !this.allowExpire) {
		return cb(new Error('Expiration time is not allowed on this vault (file: ' + filenameWithoutExt + ')'));
	}

	// Check if the key contains sub-folders. If so, ensure they exist before writing
	createKeyFolders(filenameWithoutExt, filePath, function (error) {
		if (error) {
			return cb(error);
		}

		var writeFlags = (addOnly) ? 'wx' : 'w';
		writeWithOptions(filePath, { flags: writeFlags }, JSON.stringify(meta, null, '\t'), function (error) {
			if (error) {
				that.logger.alert('Failed to write meta data to:', filePath, error);
			}

			applyTTL(that, filenameWithoutExt, meta.expirationTime);

			cb(error);
		});
	});
};


/**
 * Deletes a meta file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.delMeta = function (filenameWithoutExt, cb) {
	var that = this;
	var filePath = this._createMetaPath(filenameWithoutExt);

	fs.unlink(filePath, function (error) {
		if (error) {
			that.logger.alert('Failed to delete meta data from:', filePath);
		}

		// Remove the timer if it had one.

		clearTimeout(that._timers[filenameWithoutExt]);
		delete that._timers[filenameWithoutExt];

		cb(error);
	});
};


/**
 * Returns the full data of a content file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @param {Function} cb
 */

FileVault.prototype.getContent = function (filenameWithoutExt, ext, cb) {
	var that = this;
	var filePath = this._createContentPath(filenameWithoutExt, ext);

	fs.readFile(filePath, function (error, data) {
		if (error) {
			that.logger.alert('Failed to read content from:', filePath);
			return cb(error);
		}

		cb(null, data);
	});
};


/**
 * Creates or overwrites the full data of a content file.
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @param {Buffer} content
 * @param {Function} cb
 */

FileVault.prototype.setContent = function (filenameWithoutExt, ext, content, cb) {
	var that = this;
	var filePath = this._createContentPath(filenameWithoutExt, ext);

	writeWithOptions(filePath, { flags: 'w' }, content, function (error) {
		if (error) {
			that.logger.alert('Failed to write content to:', filePath);
		}

		cb(error);
	});
};


/**
 * Deletes a content file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @param {Function} cb
 */


FileVault.prototype.delContent = function (filenameWithoutExt, ext, cb) {
	var that = this;
	var filePath = this._createContentPath(filenameWithoutExt, ext);

	fs.unlink(filePath, function (error) {
		if (error) {
			that.logger.alert('Failed to delete content from:', filePath);
		}

		cb(error);
	});
};


/**
 * Recursively scans a directory for all files. This will then yield an array of all filenames
 * relative to the give rootPath.
 *
 * @param {Function} rootPath
 * @param {Function} cb
 */
function recursiveFileList(rootPath, cb) {
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
				recursiveFileList(filePath, function (error, childFileList) {
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
}


/**
 * Yields an array of all meta files (which are stripped from their paths and extensions), and
 * optionally applies a filter/transformation map function.
 *
 * @param {Function} map
 * @param {Function} cb
 */

FileVault.prototype.scan = function (map, cb) {
	var that = this;

	recursiveFileList(this.path, function (error, files) {
		if (error) {
			that.logger.error('Error while trying to scan', error);
			return cb(error);
		}

		var result = [];

		for (var i = 0; i < files.length; i++) {
			var entry = files[i];

			// only allow meta files

			if (path.extname(entry) !== META_FILE_EXTENSION) {
				continue;
			}

			// strip the extension from the file

			entry = entry.slice(0, -META_FILE_EXTENSION.length);

			// allow for map/filter to happen

			if (map) {
				entry = map(entry);
			}

			if (entry) {
				result.push(entry);
			}
		}

		cb(null, result);
	});
};


/**
 * Returns the serialized content of a file with its meta data, or undefined if it's not found.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.get = function (filenameWithoutExt, cb) {
	var that = this;

	this.logger.verbose('get:', filenameWithoutExt);

	this.optMeta(filenameWithoutExt, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta) {
			return cb();
		}

		that.getContent(filenameWithoutExt, meta.ext, function (error, content) {
			if (error) {
				return cb(error);
			}

			cb(null, {
				meta: meta,
				content: content
			});
		});
	});
};


/**
 * Creates a file with the given serialized content and meta data. Yields an
 * error if the a file by that name already exists.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} data an object that contains a "meta" and a "content" property
 * @param {Function} cb
 */

FileVault.prototype.add = function (filenameWithoutExt, data, cb) {
	var that = this;

	this.logger.verbose('add:', filenameWithoutExt);

	this.writeMeta(filenameWithoutExt, data.meta, true, function (error) {
		if (error) {
			return cb(error);
		}

		that.setContent(filenameWithoutExt, data.meta.ext, data.content, cb);
	});
};


FileVault.prototype.removeOldExtension = function (filenameWithoutExt, newExt, cb) {
	var that = this;

	this.optMeta(filenameWithoutExt, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta || meta.ext === newExt) {
			// file doesn't exist or already has that extension, so nothing to do
			return cb();
		}

		that.logger.debug(filenameWithoutExt, 'got a new extension', newExt, 'deleting old one.');

		that.delContent(filenameWithoutExt, meta.ext, function () {
			// ignore errors

			cb();
		});
	});
};

/**
 * Creates or overwrites a file with the given serialized content and meta data.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} data an object that contains a "meta" and a "content" property
 * @param {Function} cb
 */

FileVault.prototype.set = function (filenameWithoutExt, data, cb) {
	var that = this;

	this.removeOldExtension(filenameWithoutExt, data.meta.ext, function () {
		// ignore errors

		that.logger.verbose('set:', filenameWithoutExt);

		that.writeMeta(filenameWithoutExt, data.meta, false, function (error) {
			if (error) {
				return cb(error);
			}

			that.setContent(filenameWithoutExt, data.meta.ext, data.content, cb);
		});
	});
};


/**
 * Function which recursively attempts to delete folders relative to our basepath. This is a cleanup
 * phase after document deletion. If there is an error during the directory removal, we just ignore
 * it and continue on.
 *
 * @param {String} childpath
 * @param {Function} cb
 */

function deleteEmptyParentFolders(rootPath, childpath, cb) {
	var filePath = path.join(rootPath, childpath);

	// Don't delete if we have reached the base
	if (!childpath || childpath === '.') {
		return cb();
	}

	fs.rmdir(filePath, function (error) {
		if (error) {
			return cb();
		}

		return deleteEmptyParentFolders(rootPath, path.dirname(childpath), cb);
	});
}


/**
 * Deletes a file. Does not yield an error if the file did not exist to begin with.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.del = function (filenameWithoutExt, cb) {
	var that = this;

	this.logger.verbose('del:', filenameWithoutExt);

	this.optMeta(filenameWithoutExt, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta) {
			// file doesn't exist, so nothing to do
			return cb();
		}

		that.delMeta(filenameWithoutExt, function (error) {
			if (error) {
				return cb(error);
			}

			that.delContent(filenameWithoutExt, meta.ext, function (error) {
				if (error) {
					return cb(error);
				}

				// Attempt to remove empty folders. If it fails we just ignore the errors and
				// continue.
				deleteEmptyParentFolders(that.path, path.dirname(filenameWithoutExt), cb);
			});
		});
	});
};


/**
 * Sets the expirationTime on a file without modifying its contents. Yields an error if the file
 * does not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {number} expirationTime
 * @param {Function} cb
 */

FileVault.prototype.touch = function (filenameWithoutExt, expirationTime, cb) {
	var that = this;

	this.logger.verbose('touch:', filenameWithoutExt, expirationTime || 'no expiration');

	this.getMeta(filenameWithoutExt, function (error, meta) {
		if (error) {
			return cb(error);
		}

		meta.expirationTime = expirationTime;

		that.writeMeta(filenameWithoutExt, meta, false, function (error) {
			if (error) {
				return cb(error);
			}

			cb();
		});
	});
};


/**
 * Function which will delete all empty sub-directories in a given rootpath.
 *
 * @param {String} rootpath
 * @param {String} childpath
 * @param {Function} cb
 */

function purgeEmptySubFolders(rootpath, childpath, cb) {
	childpath = childpath || '';
	var fullpath = path.join(rootpath, childpath);

	fs.readdir(fullpath, function (error, files) {
		if (error) {
			return cb();
		}

		async.eachSeries(files, function (file, callback) {
			var filepath = path.join(fullpath, file);
			fs.stat(filepath, function (error, stat) {
				if (error || !stat.isDirectory()) {
					return callback();
				}

				// Recurse inwards
				purgeEmptySubFolders(rootpath, path.join(childpath, file), callback);
			});
		}, function () {
			// Do nothing if rootpath
			if (!childpath) {
				return cb();
			}

			// Otherwise attempt to remove directory
			fs.rmdir(fullpath, function () {
				return cb();
			});
		});
	});
}


/**
 * Reads all of the meta files in the fileVault. If we read an expired meta file, it will clean
 * itself up.
 *
 * @param {Function} cb
 */

FileVault.prototype.checkMeta = function (cb) {
	if (!this.allowExpire) {
		this.logger.debug('This vault does not allow value expiration, skipping meta checking');
		return cb();
	}

	var that = this;

	this.logger.debug('Checking meta files');

	this.scan(null, function (error, filenamesWithoutExt) {
		if (error) {
			return cb(error);
		}

		async.eachLimit(filenamesWithoutExt, EXPIRE_MAX_PARALLEL, that.optMeta.bind(that), function (error) {
			if (error) {
				return cb(error);
			}

			// Purge away empty sub-directories
			purgeEmptySubFolders(that.path, null, cb);
		});
	});
};

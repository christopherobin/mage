// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

// NOTE: extension variables always contain the period as the first character

var pathBaseName = require('path').basename;
var pathExtName = require('path').extname;
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var fs = require('fs');
var async = require('async');
var Archive = require('./Archive');


// export the defaultValueHandlers

exports.defaultValueHandlers = require('./defaultValueHandlers');


// constants

var META_FILE_EXTENSION = '.filevault';


// helper functions

function safeExt(ext) {
	return ext[0] === '.' ? ext : '.' + ext;
}


function writeWithOptions(path, options, data, cb) {
	var stream;

	try {
		stream = fs.createWriteStream(path, options);
	} catch (error) {
		return cb(error);
	}

	stream.once('error', cb);
	stream.once('close', cb);

	stream.once('open', function () {
		stream.write(data);
		stream.end();
	});
}


function applyTTL(fileVault, filenameWithoutExt, expirationTime) {
	clearTimeout(fileVault._timers[filenameWithoutExt]);

	if (!expirationTime) {
		delete fileVault._timers[filenameWithoutExt];
		return;
	}

	var ttl = expirationTime * 1000 - Date.now();

	fileVault._timers[filenameWithoutExt] = setTimeout(function expireByTimeout() {
		delete fileVault._timers[filenameWithoutExt];

		fileVault.expire(filenameWithoutExt, function () {});
	}, ttl);
}


// Vault wrapper around node's "fs" module

function FileVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

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
	var path = this.path = pathResolve(cfg ? cfg.path : './tmp');

	var logger = this.logger;
	var that = this;

	fs.stat(path, function (err, stats) {
		if (err) {
			if (err.code === 'ENOENT') {
				logger.emergency('Path', path, 'not found. Please check your configuration for vault', that.name);
			} else {
				logger.emergency('Error while performing a stat on:', path, err);
			}

			return cb(err);
		}

		if (!stats.isDirectory()) {
			logger.emergency('Path', path, 'is not a directory. Please check your configuration for vault', that.name);
			return cb(new Error('Path not a directory'));
		}

		that.checkExpirations(cb);
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
 * Creates a full path to a meta file
 *
 * @param {string} filenameWithoutExt
 * @returns {string} full path to a meta file
 */

FileVault.prototype._createMetaPath = function (filenameWithoutExt) {
	return pathJoin(this.path, filenameWithoutExt) + META_FILE_EXTENSION;
};


/**
 * Creates a full path to a content file
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @returns {string} full path to a content file
 */

FileVault.prototype._createContentPath = function (filenameWithoutExt, ext) {
	return pathJoin(this.path, filenameWithoutExt) + safeExt(ext);
};


/**
 * Gets the parsed contents from a meta file.
 * Yields an error if the file does not exist or cannot be parsed.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.getMeta = function (filenameWithoutExt, cb) {
	var that = this;
	var path = this._createMetaPath(filenameWithoutExt);

	fs.readFile(path, { encoding: 'utf8' }, function (error, data) {
		if (error) {
			that.logger.alert('Could not read meta data from file:', path);
			return cb(error);
		}

		try {
			data = JSON.parse(data);
		} catch (parseError) {
			that.logger.alert('Failed to parse meta data:', data, 'from file:', path);
			return cb(parseError);
		}

		cb(null, data);
	});
};


/**
 * Gets the parsed contents from a meta file.
 * Yields an error if the file cannot be parsed. If the file does not exist, undefined is returned.

 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.optMeta = function (filenameWithoutExt, cb) {
	var that = this;
	var path = this._createMetaPath(filenameWithoutExt);

	fs.readFile(path, { encoding: 'utf8' }, function (error, data) {
		if (error) {
			// An error of non-existence is not an error to us, it would simply return the value
			// undefined.

			if (error.code === 'ENOENT') {
				return cb(null, undefined);
			}

			that.logger.alert('Could not read meta data from file:', path);
			return cb(error);
		}

		try {
			data = JSON.parse(data);
		} catch (parseError) {
			that.logger.alert('Failed to parse meta data:', data, 'from file:', path);
			return cb(parseError);
		}

		cb(null, data);
	});
};


/**
 * Creates a meta file if it didn't already exist. If it did, an error is returned.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} meta
 * @param {Function} cb
 */

FileVault.prototype.addMeta = function (filenameWithoutExt, meta, cb) {
	var that = this;
	var path = this._createMetaPath(filenameWithoutExt);

	writeWithOptions(path, { flags: 'wx' }, JSON.stringify(meta), function (error) {
		if (error) {
			that.logger.alert('Failed to write meta data to:', path);
		}

		cb(error);
	});
};


/**
 * Creates or overwrites a meta file.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} meta
 * @param {Function} cb
 */

FileVault.prototype.setMeta = function (filenameWithoutExt, meta, cb) {
	var that = this;
	var path = this._createMetaPath(filenameWithoutExt);

	writeWithOptions(path, { flags: 'w' }, JSON.stringify(meta), function (error) {
		if (error) {
			that.logger.alert('Failed to write meta data to:', path);
		}

		cb(error);
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
	var path = this._createMetaPath(filenameWithoutExt);

	fs.unlink(path, function (error) {
		if (error) {
			that.logger.alert('Failed to delete meta data from:', path);
		}

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
	var path = this._createContentPath(filenameWithoutExt, ext);

	fs.readFile(path, function (error, data) {
		if (error) {
			that.logger.alert('Failed to read content from:', path);
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
	var path = this._createContentPath(filenameWithoutExt, ext);

	writeWithOptions(path, { flags: 'w' }, content, function (error) {
		if (error) {
			that.logger.alert('Failed to write content to:', path);
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
	var path = this._createContentPath(filenameWithoutExt, ext);

	fs.unlink(path, function (error) {
		if (error) {
			that.logger.alert('Failed to delete content from:', path);
		}

		cb(error);
	});
};


/**
 * Yields an array of all meta files (which are stripped from their paths and extensions), and
 * optionally applies a filter/transformation map function.
 *
 * @param {Function} map
 * @param {Function} cb
 */

FileVault.prototype.scan = function (map, cb) {
	var that = this;

	fs.readdir(this.path, function (error, files) {
		if (error) {
			that.logger.error('Error while trying to scan', error);

			return cb(error);
		}

		var result = [];

		for (var i = 0; i < files.length; i++) {
			var entry = files[i];

			// only allow meta files

			if (pathExtName(entry) !== META_FILE_EXTENSION) {
				continue;
			}

			// strip the extension from the file

			entry = pathBaseName(entry, META_FILE_EXTENSION);

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
			return cb(null, undefined);
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
 * Creates a file with the given serialized content and meta data, and applies an expirationTime if
 * given. Yields an error if the a file by that name already exists.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} data an object that contains a "meta" and a "content" property
 * @param {number} expirationTime
 * @param {Function} cb
 */

FileVault.prototype.add = function (filenameWithoutExt, data, expirationTime, cb) {
	var that = this;

	this.logger.verbose('add:', filenameWithoutExt);

	this.addMeta(filenameWithoutExt, data.meta, function (error) {
		if (error) {
			return cb(error);
		}

		applyTTL(that, filenameWithoutExt, expirationTime);

		that.setContent(filenameWithoutExt, data.meta.ext, data.content, cb);
	});
};


/**
 * Creates or overwrites a file with the given serialized content and meta data, and applies an
 * expirationTime if given.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} data an object that contains a "meta" and a "content" property
 * @param {number} expirationTime
 * @param {Function} cb
 */

FileVault.prototype.set = function (filenameWithoutExt, data, expirationTime, cb) {
	var that = this;

	this.logger.verbose('Deleting', filenameWithoutExt, 'before recreating it');

	this.del(filenameWithoutExt, function () {
		// ignore errors

		that.logger.verbose('set:', filenameWithoutExt);

		that.setMeta(filenameWithoutExt, data.meta, function (error) {
			if (error) {
				return cb(error);
			}

			applyTTL(that, filenameWithoutExt, expirationTime);

			that.setContent(filenameWithoutExt, data.meta.ext, data.content, cb);
		});
	});
};


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

			applyTTL(that, filenameWithoutExt);

			that.delContent(filenameWithoutExt, meta.ext, cb);
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

		that.setMeta(filenameWithoutExt, meta, function (error) {
			if (error) {
				return cb(error);
			}

			applyTTL(that, filenameWithoutExt, expirationTime);

			cb();
		});
	});
};


/**
 * Deletes a file. Does not yield an error if the file did not exist to begin with. Only to be used
 * when applying expiration logic.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.expire = function (filenameWithoutExt, cb) {
	var that = this;

	this.logger.verbose('expire:', filenameWithoutExt);

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

			that.delContent(filenameWithoutExt, meta.ext, cb);
		});
	});
};


/**
 * Scans the entire folder for expired files, and removes them if found.
 *
 * @param {Function} cb
 */

FileVault.prototype.checkExpirations = function (cb) {
	var that = this;

	this.logger.debug('Checking for expired data');

	this.scan(null, function (error, filenamesWithoutExt) {
		if (error) {
			return cb(error);
		}

		var now = parseInt(Date.now() / 1000, 10);

		function checkExpiration(filenameWithoutExt, callback) {
			that.getMeta(filenameWithoutExt, function (error, meta) {
				if (error) {
					return callback(error);
				}

				if (!meta.expirationTime) {
					that.logger.verbose('File never expires:', filenameWithoutExt);
					return callback();
				}

				if (meta.expirationTime > now) {
					that.logger.verbose('File will expire in', meta.expirationTime - now, 'seconds:', filenameWithoutExt);
					return callback();
				}

				that.logger.verbose('Expiration passed', now - meta.expirationTime, 'seconds ago on file:', filenameWithoutExt);

				that.expire(filenameWithoutExt, callback);
			});
		}

		async.forEachSeries(filenamesWithoutExt, checkExpiration, cb);
	});
};

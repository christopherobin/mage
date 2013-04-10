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
var qs = require('querystring');
var async = require('async');
var mediaTypes = require('../../mediaTypes');


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
		fileVault.expire(filenameWithoutExt, function () {
			delete fileVault._timers[filenameWithoutExt];
		});
	}, ttl);
}


function sortIndexes(indexes, sort) {
	function compare(a, b) {
		return a > b ? -1 : (b > a ? 1 : 0);
	}

	// format: [{ name: 'colName', direction: 'asc' }, { name: 'colName2', direction: 'desc' }]
	// direction is 'asc' by default

	indexes.sort(function (a, b) {
		var result = 0;

		for (var i = 0; i < sort.length && result === 0; i++) {
			var prop = sort[i].name;
			var factor = sort[i].direction === 'desc' ? -1 : 1;

			result = factor * compare(a[prop], b[prop]);
		}

		return result;
	});
}


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		// throws exceptions on failure

		value.setEncoding('buffer', { pretty: true });

		var mediaType = mediaTypes.getMediaType(value.mediaType);
		if (!mediaType) {
			throw new Error('Unsupported media type: ' + value.mediaType);
		}

		return {
			meta: {
				mediaType: value.mediaType,
				expirationTime: value.expirationTime || undefined,
				ext: safeExt(mediaType.fileExt) || '.bin'
			},
			content: value.data
		};
	},
	deserialize: function (data, value) {
		var meta = data.meta;
		var content = data.content;

		// data is: { meta: {}, content: buffer }

		if (!Buffer.isBuffer(content)) {
			throw new Error('FileVault can only read binary');
		}

		// report the value object

		value.setData(meta.mediaType, content, 'buffer');
		value.setExpirationTime(meta.expirationTime);
	},
	createKey: function (topic, index) {
		// URL encoded with the arguments sorted alphabetically
		// eg: weapons?actorId=123&bag=main

		var key = encodeURIComponent(topic);

		if (index) {
			var props = Object.keys(index);
			var len = props.length;

			if (len > 0) {
				props.sort();

				key = key.concat('?');

				var sep = '';

				for (var i = 0; i < len; i += 1) {
					key = key.concat(sep, encodeURIComponent(props[i]), '=', encodeURIComponent(index[props[i]]));
					sep = '&';
				}
			}
		}

		return key;
	},
	parseKey: function (path) {
		var key = pathBaseName(path);

		var qsPos = key.indexOf('?');

		if (qsPos === -1) {
			return {
				topic: decodeURIComponent(key),
				index: {}
			};
		}

		return {
			topic: decodeURIComponent(key.substr(0, qsPos)),
			index: qs.parse(key.substr(qsPos + 1))
		};
	}
};


// Archivist bindings into the FileVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	// partialIndex must contain all properties, but the unknowns must be set to undefined

	var check = api.index;
	var sort = options && options.sort;
	var chunk = options && options.chunk;

	var that = this;

	function map(path) {
		var parsed;

		try {
			parsed = api.parseKey(path);
		} catch (error) {
			that.vault.logger.warning(error);
			return;
		}

		if (!parsed || parsed.topic !== topic) {
			return;
		}

		for (var i = 0; i < check.length; i++) {
			var prop = check[i];

			if (partialIndex.hasOwnProperty(prop)) {
				var givenValue = '' + partialIndex[prop];
				var parsedValue = '' + parsed.index[prop];

				if (parsedValue !== givenValue) {
					return;
				}
			}
		}

		return parsed.index;
	}

	this.vault.scan(map, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		if (sort) {
			sortIndexes(indexes, sort);
		}

		if (chunk) {
			if (chunk.length === 2) {
				indexes = indexes.slice(chunk[0], chunk[0] + chunk[1]);
			} else {
				indexes = indexes.slice(chunk[0]);
			}
		}

		cb(null, indexes);
	});
};


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createKey(value.topic, value.index), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


Archive.prototype.add = function (api, value, cb) {
	this.vault.add(api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createKey(value.topic, value.index), cb);
};

Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.createKey(value.topic, value.index), value.expirationTime, cb);
};


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
 * Prepares the vault to be used
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

FileVault.prototype.destroy = function () {
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
	fs.readFile(this._createMetaPath(filenameWithoutExt), { encoding: 'utf8' }, function (error, data) {
		if (error) {
			return cb(error);
		}

		try {
			data = JSON.parse(data);
		} catch (parseError) {
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
	this.getMeta(filenameWithoutExt, function (error, meta) {
		if (error) {
			// an error of non-existence is not an error to us, it would simply return the value undefined
			// all other errors are really errors

			if (error.code === 'ENOENT') {
				return cb(null, undefined);
			}

			return cb(error);
		}

		return cb(null, meta);
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
	writeWithOptions(this._createMetaPath(filenameWithoutExt), { flags: 'wx' }, JSON.stringify(meta), cb);
};


/**
 * Creates or overwrites a meta file.
 *
 * @param {string} filenameWithoutExt
 * @param {Object} meta
 * @param {Function} cb
 */

FileVault.prototype.setMeta = function (filenameWithoutExt, meta, cb) {
	writeWithOptions(this._createMetaPath(filenameWithoutExt), { flags: 'w' }, JSON.stringify(meta), cb);
};


/**
 * Deletes a meta file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {Function} cb
 */

FileVault.prototype.delMeta = function (filenameWithoutExt, cb) {
	fs.unlink(this._createMetaPath(filenameWithoutExt), cb);
};


/**
 * Returns the full data of a content file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @param {Function} cb
 */

FileVault.prototype.getContent = function (filenameWithoutExt, ext, cb) {
	fs.readFile(this._createContentPath(filenameWithoutExt, ext), cb);
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
	writeWithOptions(this._createContentPath(filenameWithoutExt, ext), { flags: 'w' }, content, cb);
};


/**
 * Deletes a content file. Yields an error if the file did not exist.
 *
 * @param {string} filenameWithoutExt
 * @param {string} ext
 * @param {Function} cb
 */


FileVault.prototype.delContent = function (filenameWithoutExt, ext, cb) {
	fs.unlink(this._createContentPath(filenameWithoutExt, ext), cb);
};


/**
 * Yields an array of all meta files (which are stripped from their paths and extensions), and
 * optionally applies a filter/transformation map function.
 *
 * @param {Function} map
 * @param {Function} cb
 */

FileVault.prototype.scan = function (map, cb) {
	fs.readdir(this.path, function (error, files) {
		if (error) {
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
			that.logger.error('Error while trying to scan', error);

			return cb(error);
		}

		var now = parseInt(Date.now() / 1000, 10);

		function checkExpiration(filenameWithoutExt, callback) {
			that.getMeta(filenameWithoutExt, function (error, meta) {
				if (error) {
					that.logger.error('Error while trying to get meta information for', filenameWithoutExt, error);

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

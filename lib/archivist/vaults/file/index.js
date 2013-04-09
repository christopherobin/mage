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


function applyTTL(fileVault, path, expirationTime) {
	clearTimeout(fileVault._timers[path]);

	if (!expirationTime) {
		delete fileVault._timers[path];
		return;
	}

	var ttl = expirationTime * 1000 - Date.now();

	fileVault._timers[path] = setTimeout(function expireByTimeout() {
		fileVault.expire(path, function () {
			delete fileVault._timers[path];
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


FileVault.prototype.setup = function (cfg, cb) {
	var path = this.path = pathResolve(cfg ? cfg.path : './tmp');

	var logger = this.logger;
	var that = this;

	fs.stat(path, function (err, stats) {
		if (err) {
			if (err.code === 'ENOENT') {
				logger.emergency('Path', path, 'not found. Please check your configuration for vault', that.name);
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


FileVault.prototype.destroy = function () {
};


FileVault.prototype._createMetaPath = function (key) {
	return pathJoin(this.path, key) + META_FILE_EXTENSION;
};


FileVault.prototype._createContentPath = function (key, ext) {
	return pathJoin(this.path, key) + safeExt(ext);
};


FileVault.prototype.getMeta = function (path, cb) {
	fs.readFile(this._createMetaPath(path), { encoding: 'utf8' }, function (error, data) {
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


FileVault.prototype.optMeta = function (path, cb) {
	this.getMeta(path, function (error, meta) {
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


FileVault.prototype.addMeta = function (path, meta, cb) {
	writeWithOptions(this._createMetaPath(path), { flags: 'wx' }, JSON.stringify(meta), cb);
};


FileVault.prototype.setMeta = function (path, meta, cb) {
	writeWithOptions(this._createMetaPath(path), { flags: 'w' }, JSON.stringify(meta), cb);
};


FileVault.prototype.delMeta = function (path, cb) {
	fs.unlink(this._createMetaPath(path), cb);
};


FileVault.prototype.getContent = function (path, ext, cb) {
	fs.readFile(this._createContentPath(path, ext), cb);
};


FileVault.prototype.setContent = function (path, ext, content, cb) {
	writeWithOptions(this._createContentPath(path, ext), { flags: 'w' }, content, cb);
};


FileVault.prototype.delContent = function (path, ext, cb) {
	fs.unlink(this._createContentPath(path, ext), cb);
};


// scan finds all meta data, and applies a transformation/filter map function to their filenames
// (which are stripped from their paths and extensions)

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


FileVault.prototype.get = function (path, cb) {
	var that = this;

	this.logger.verbose('get:', path);

	this.optMeta(path, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta) {
			return cb(null, undefined);
		}

		that.getContent(path, meta.ext, function (error, content) {
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


FileVault.prototype.add = function (path, data, expirationTime, cb) {
	var that = this;

	this.logger.verbose('add:', path);

	this.addMeta(path, data.meta, function (error) {
		if (error) {
			return cb(error);
		}

		applyTTL(that, path, expirationTime);

		that.setContent(path, data.meta.ext, data.content, cb);
	});
};


FileVault.prototype.set = function (path, data, expirationTime, cb) {
	var that = this;

	this.logger.verbose('deleting', path, 'before recreating it');

	this.del(path, function () {
		// ignore errors

		that.logger.verbose('set:', path);

		that.setMeta(path, data.meta, function (error) {
			if (error) {
				return cb(error);
			}

			applyTTL(that, path, expirationTime);

			that.setContent(path, data.meta.ext, data.content, cb);
		});
	});
};


FileVault.prototype.del = function (path, cb) {
	var that = this;

	this.logger.verbose('del:', path);

	this.optMeta(path, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta) {
			// file doesn't exist, so nothing to do
			return cb();
		}

		that.delMeta(path, function (error) {
			if (error) {
				return cb(error);
			}

			applyTTL(that, path);

			that.delContent(path, meta.ext, cb);
		});
	});
};


FileVault.prototype.touch = function (path, expirationTime, cb) {
	var that = this;

	this.logger.verbose('touch:', path, expirationTime || 'no expiration');

	this.getMeta(path, function (error, meta) {
		if (error) {
			return cb(error);
		}

		meta.expirationTime = expirationTime;

		that.setMeta(path, meta, function (error) {
			if (error) {
				return cb(error);
			}

			applyTTL(that, path, expirationTime);

			cb();
		});
	});
};


FileVault.prototype.expire = function (path, cb) {
	var that = this;

	this.logger.verbose('expire:', path);

	this.optMeta(path, function (error, meta) {
		if (error) {
			return cb(error);
		}

		if (!meta) {
			// file doesn't exist, so nothing to do
			return cb();
		}

		that.delMeta(path, function (error) {
			if (error) {
				return cb(error);
			}

			that.delContent(path, meta.ext, cb);
		});
	});
};


FileVault.prototype.checkExpirations = function (cb) {
	var that = this;

	this.logger.debug('Checking for expired data');

	this.scan(null, function (error, paths) {
		if (error) {
			that.logger.error('Error while trying to scan', error);

			return cb(error);
		}

		var now = parseInt(Date.now() / 1000, 10);

		function checkExpiration(path, callback) {
			that.getMeta(path, function (error, meta) {
				if (error) {
					that.logger.error('Error while trying to get meta information for', path, error);

					return callback(error);
				}

				if (!meta.expirationTime) {
					that.logger.verbose('File never expires:', path);
					return callback();
				}

				if (meta.expirationTime > now) {
					that.logger.verbose('File will expire in', meta.expirationTime - now, 'seconds:', path);
					return callback();
				}

				that.logger.verbose('Expiration passed', now - meta.expirationTime, 'seconds ago on file:', path);

				that.expire(path, callback);
			});
		}

		async.forEachSeries(paths, checkExpiration, cb);
	});
};

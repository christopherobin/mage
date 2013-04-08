// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

var pathBaseName = require('path').basename;
var pathExtName = require('path').extname;
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var fs = require('fs');
var qs = require('querystring');
var async = require('async');

// constants

var HEADER_DELIMITER = new Buffer('\n'); // may only be 1 character
var FILE_EXTENSION = '.dubloon';

// helper functions

function bufferIndexOf(buffer, code, maxIndex) {
	// look for the delimiter

	var i, len = buffer.length;

	if (maxIndex && len > maxIndex) {
		len = maxIndex;
	}

	for (i = 0; i < len; i++) {
		if (buffer[i] === code) {
			return i;
		}
	}

	return -1;
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
		return;
	}

	var ttl = expirationTime * 1000 - new Date();

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

		var expirationTime = value.expirationTime ? value.expirationTime.toString(16) : '00000000';
		var header = new Buffer(expirationTime.concat(value.mediaType));

		return Buffer.concat([header, HEADER_DELIMITER, value.data]);
	},
	deserialize: function (data, value) {
		// throws exceptions on failure

		if (!Buffer.isBuffer(data)) {
			throw new Error('FileVault can only read binary');
		}

		// look for the header delimiter

		var index = bufferIndexOf(data, HEADER_DELIMITER[0], 100);
		if (index < 1) {
			throw new Error('Could not detect mediaType from binary data');
		}

		// extract expirationTime

		var expirationTime = parseInt(data.slice(0, 8).toString(), 16);

		// extract mediaType string

		var mediaType = data.slice(8, index).toString();

		// extract data

		data = data.slice(index + 1);

		// report the value object

		value.setData(mediaType, data, 'buffer');
		value.setExpirationTime(expirationTime);
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

		return key.concat(FILE_EXTENSION);
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
		var errorMsg;
		if (err) {
			if (err.code === 'ENOENT') {
				errorMsg = path + ' not found. Check your config.';
				logger.emergency(errorMsg);
			}
			return cb(errorMsg || err);
		}

		if (!stats.isDirectory()) {
			errorMsg = path + ' is not a directory. Check your config.';
			logger.emergency(errorMsg);
			return cb(new Error(errorMsg));
		}
		that.checkExpirations(cb);
	});
};


FileVault.prototype.destroy = function () {
};


FileVault.prototype._createPath = function (key) {
	return pathJoin(this.path, key);
};


FileVault.prototype.scan = function (map, cb) {
	fs.readdir(this.path, function (error, files) {
		if (error) {
			return cb(error);
		}

		var result = [];

		for (var i = 0; i < files.length; i++) {
			var entry = files[i];

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
	var filePath = this._createPath(path);

	this.logger.verbose('get:', filePath);

	fs.readFile(filePath, function (error, data) {
		if (error) {
			// an error of non-existence is not an error to us, it would simply return the value undefined!
			// all other errors are really errors

			if (error.code === 'ENOENT') {
				return cb(null, undefined);
			}

			return cb(error);
		}

		cb(null, data);
	});
};


FileVault.prototype.add = function (path, data, expirationTime, cb) {
	var filePath = this._createPath(path);

	this.logger.verbose('add:', filePath);

	applyTTL(this, path, expirationTime);

	writeWithOptions(filePath, { flags: 'wx' }, data, cb);
};


FileVault.prototype.set = function (path, data, expirationTime, cb) {
	var filePath = this._createPath(path);

	this.logger.verbose('set:', filePath);

	applyTTL(this, path, expirationTime);

	writeWithOptions(filePath, { flags: 'w' }, data, cb);
};


FileVault.prototype.del = function (path, cb) {
	var filePath = this._createPath(path);

	this.logger.verbose('del:', filePath);

	fs.unlink(filePath, cb);
};

FileVault.prototype.touch = function (path, expirationTime, cb) {
	var filePath = this._createPath(path);

	this.logger.verbose('touch:', filePath);

	applyTTL(this, path, expirationTime);

	var hexTime = expirationTime ? expirationTime.toString(16) : '00000000';

	writeWithOptions(filePath, { flags: 'r+' }, hexTime, cb);
};

FileVault.prototype.expire = function (path, cb) {
	var filePath = this._createPath(path);

	this.logger.verbose('expire:', filePath);

	fs.unlink(filePath, cb);
};

FileVault.prototype.checkExpirations = function (cb) {
	var that = this;

	function checkExpiration(path, callback) {
		if (pathExtName !== FILE_EXTENSION) {
			return callback();
		}

		var filePath = that._createPath(path);

		fs.open(filePath, 'r', function (error, fd) {
			if (error) {
				that.logger.alert('Error opening file:', filePath, error);
				return callback(error);
			}
			var expirationBuffer = new Buffer(8);

			fs.read(fd, expirationBuffer, 0, 8, 0, function (error, num) {
				if (error) {
					that.logger.alert('Error reading file:', filePath, error);
					return callback(error);
				}

				if (num < 8) {
					// Did not read 8 bytes, so skip it.
					return callback();
				}

				var expirationTime = parseInt(expirationBuffer.toString(), 16);

				that.logger.alert(expirationTime);

				if (!expirationTime || expirationTime > Date.now() / 1000) {
					return callback();
				}

				that.expire(path, callback);
			});
		});
	}

	fs.readdir(this.path, function (error, files) {
		async.forEachSeries(files, checkExpiration, cb);
	});
};
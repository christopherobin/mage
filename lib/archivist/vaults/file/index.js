// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var fs = require('fs');
var qs = require('querystring');


// constants

var HEADER_DELIMITER = new Buffer('\n'); // may only be 1 character


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


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		// throws exceptions on failure

		value.setEncoding('buffer', { pretty: true });

		var header = new Buffer(value.mediaType);

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

		// extract mediaType string

		var mediaType = data.slice(0, index).toString();

		// extract data

		data = data.slice(index + 1);

		// report the value object

		value.setData(mediaType, data, 'buffer');
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

				key += '?';

				for (var i = 0; i < len; i++) {
					key += encodeURIComponent(props[i]) + '=' + encodeURIComponent(index[props[i]]);
				}
			}
		}

		return key;
	},
	parseKey: function (key) {
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


Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	// partialIndex must contain all properties, but the unknowns must be set to undefined

	var check = api.index;
	var sort = options && options.sort;
	var chunk = options && options.chunk;

	function map(path) {
		var parsed;

		try {
			parsed = api.parseKey(path);
		} catch (error) {
			this.logger.warning(error);
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
	this.vault.add(api.createKey(value.topic, value.index), api.serialize(value), cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createKey(value.topic, value.index), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createKey(value.topic, value.index), cb);
};


// Vault wrapper around node's "fs" module

function FileVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.path = undefined;
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new FileVault(name, logger);
};


FileVault.prototype.setup = function (cfg, cb) {
	this.path = pathResolve(cfg.path);

	cb();
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
	path = this._createPath(path);

	this.logger.verbose('get:', path);

	fs.readFile(path, function (error, data) {
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


FileVault.prototype.add = function (path, data, cb) {
	path = this._createPath(path);

	this.logger.verbose('add:', path);

	writeWithOptions(path, { flags: 'wx' }, data, cb);
};


FileVault.prototype.set = function (path, data, cb) {
	path = this._createPath(path);

	this.logger.verbose('set:', path);

	writeWithOptions(path, { flags: 'w' }, data, cb);
};


FileVault.prototype.del = function (path, cb) {
	path = this._createPath(path);

	this.logger.verbose('del:', path);

	fs.unlink(path, cb);
};

// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var fs = require('fs');
var Value = require('../value').Value;


function FileVault(name) {
	this.name = name;
}


exports.create = function (name) {
	return new FileVault(name);
};


FileVault.prototype.setup = function (cfg, cb) {
	this.path = pathResolve(cfg.path);

	cb();
};


FileVault.prototype.destroy = function () {
};


var headerDelimiter = new Buffer('\n'); // may only be 1 character


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


function serialize(value) {
	// throws exceptions on failure

	value.setEncoding('buffer', { pretty: true });

	var header = new Buffer(value.mediaType);

	return Buffer.concat([header, headerDelimiter, value.data]);
}


function deserialize(data) {
	// throws exceptions on failure

	if (!Buffer.isBuffer(data)) {
		throw new Error('FileVault can only read binary');
	}

	// look for the header delimiter

	var index = bufferIndexOf(data, headerDelimiter[0], 100);
	if (index < 1) {
		throw new Error('Could not detect mediaType from binary data');
	}

	// extract mediaType string

	var mediaType = data.slice(0, index).toString();

	// extract data

	data = data.slice(index + 1);

	// report the value object

	return new Value(mediaType, data, 'buffer');
}


FileVault.prototype.generateKey = function (topic, vars) {
	// eg: weapons_actorId-123_bag_main
	// eg: weapons_guildId-123

	var key = topic;

	if (vars) {
		var props = Object.keys(vars);
		props.sort();

		for (var i = 0; i < props.length; i++) {
			key += '_' + props[i] + '-' + vars[props[i]];
		}
	}

	return key;
};


FileVault.prototype._createPath = function (key) {
	return pathJoin(this.path, key);
};


FileVault.prototype.read = function (key, shard, cb) {
	if (shard) {
		return cb(new Error('FileVault does not support sharding'));
	}

	fs.readFile(this._createPath(key), function (error, value) {
		if (error) {
			// an error of non-existence is not an error to us, it would simply return the value undefined!
			// all other errors are really errors

			if (error.code === 'ENOENT') {
				return cb(null, undefined);
			}

			return cb(error);
		}

		try {
			value = deserialize(value);
		} catch (e) {
			return cb(e);
		}

		cb(null, value);
	});
};


FileVault.prototype.create = function (key, shard, value, ttl, cb) {
	if (shard) {
		return cb(new Error('FileVault does not support sharding'));
	}

	if (ttl) {
		return cb(new Error('FileVault does not support TTL'));
	}

	try {
		value = serialize(value);
	} catch (e) {
		return cb(e);
	}

	fs.writeFile(this._createPath(key), value, cb);
};


FileVault.prototype.update = function (key, shard, value, ttl, cb) {
	if (shard) {
		return cb(new Error('FileVault does not support sharding'));
	}

	if (ttl) {
		return cb(new Error('FileVault does not support TTL'));
	}

	try {
		value = serialize(value);
	} catch (e) {
		return cb(e);
	}

	var path = this._createPath(key);

	fs.writeFile(path, value, cb);
};


FileVault.prototype.del = function (key, shard, cb) {
	if (shard) {
		return cb(new Error('FileVault does not support sharding'));
	}

	fs.unlink(this._createPath(key), cb);
};


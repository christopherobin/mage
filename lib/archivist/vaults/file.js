var mage = require('../../mage');
var logger = mage.core.logger.context('file-vault');


// this vault does not support sharding
//
// key format: string (compatible with a filename)
// shard format: not allowed (falsy expected)

var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var fs = require('fs');


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

exports.defaultTopicApis = {
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

		value.initWithData(mediaType, data, 'buffer');
	},
	key: function (value) {
		// eg: weapons_actorId-123_bag_main
		// eg: weapons_guildId-123

		var key = value.topic;

		if (value.index) {
			var props = Object.keys(value.index);
			props.sort();

			for (var i = 0; i < props.length; i++) {
				key += '_' + props[i] + '-' + value.index[props[i]];
			}
		}

		return key;
	}
};


// Archivist bindings into the FileVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.read = function (api, value, cb) {
	this.vault.read(api.key(value), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


Archive.prototype.create = function (api, value, cb) {
	this.vault.write(api.key(value), api.serialize(value), cb);
};


Archive.prototype.update = function (api, value, cb) {
	this.vault.write(api.key(value), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.key(value), cb);
};


// Vault wrapper around node's "fs" module

function FileVault(name) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.path = undefined;
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


FileVault.prototype._createPath = function (key) {
	return pathJoin(this.path, key);
};


FileVault.prototype.read = function (path, cb) {
	path = this._createPath(path);

	logger.verbose('read:', path);

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


FileVault.prototype.write = function (path, data, cb) {
	path = this._createPath(path);

	logger.verbose('write:', path);

	fs.writeFile(path, data, cb);
};


FileVault.prototype.del = function (path, cb) {
	path = this._createPath(path);

	logger.verbose('del:', path);

	fs.unlink(path, cb);
};

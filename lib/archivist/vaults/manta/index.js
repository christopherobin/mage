// based on node-manta, this vault does not support sharding
//
// key format: string
//
// references:
// -----------
// node-manta: https://github.com/joyent/node-manta

// Note: For constructing paths on the manta service, we do not use path.join, since we don't want
// directory separators based on MAGE's host operating system.


var Archive = require('./Archive');
var MemoryStream = require('memorystream');
var dirname = require('path').dirname;


exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-manta

function MantaVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-manta instance
	this.user = null;
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new MantaVault(name, logger);
};


MantaVault.prototype.setup = function (cfg, cb) {
	var manta = require('manta');

	// TODO: feed a bunyan shim into createClient so we can log by ourselves

	this.client = manta.createClient({
		log: this.logger.simulate('bunyan'),
		sign: manta.privateKeySigner({
			key: cfg.sign.key,
			keyId: cfg.sign.keyId,
			user: cfg.user
		}),
		user: cfg.user,
		url: cfg.url
	});

	this.user = cfg.user;

	this.logger.debug('Manta vault "' + this.name + '" ready:', this.client.toString());

	cb();
};


MantaVault.prototype.makePath = function (folder, file) {
	var path = '/' + this.user + '/stor/' + folder;

	if (file) {
		path += '/' + file;
	}

	return path;
};


MantaVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.close();
		this.client = null;
	}
};


MantaVault.prototype.ls = function (folder, options, map, cb) {
	var path = this.makePath(folder);

	this.logger.verbose('ls:', path);

	var opts = {
		offset: 0,
		limit: 1000,
		type: 'object'
	};

	if (options) {
		if (options.chunk) {
			opts.offset = options.chunk[0];
			opts.limit = options.chunk[1];
		}

		if (options.sort) {
			this.logger.warning('Manta ls-operations cannot sort');
		}
	}

	this.client.ls(path, opts, function (error, res) {
		if (error) {
			return cb(error);
		}

		var results = [];

		res.on('object', function (obj) {
			if (obj.type !== 'object') {
				return;
			}

			var entry = map ? map(obj.name) : obj.name;

			if (entry) {
				results.push(entry);
			}
		});

		res.once('error', cb);
		res.once('end', function () {
			cb(null, results);
		});
	});
};


MantaVault.prototype.get = function (folder, file, cb) {
	var path = this.makePath(folder, file);

	this.logger.verbose('get:', path);

	this.client.get(path, function (error, stream, res) {
		if (error) {
			return cb(error);
		}

		var mediaType = res.headers['content-type'];
		var buffers = [];
		var len = 0;

		stream.once('error', cb);

		stream.on('data', function (chunk) {
			buffers.push(chunk);
			len += chunk.length;
		});

		stream.once('end', function () {
			if (len === 0) {
				return cb(null, undefined);
			}

			var result = {
				data: Buffer.concat(buffers, len),
				mediaType: mediaType
			};

			cb(null, result);
		});
	});
};


MantaVault.prototype.put = function (folder, file, obj, cb) {
	var path = this.makePath(folder, file);
	var that = this;

	this.logger.verbose('put:', path);

	function put(retries) {
		var stream = new MemoryStream();

		var options = {
			type: obj.mediaType,
			size: obj.data.length
		};

		that.client.put(path, stream, options, function (error) {
			if (!error) {
				return cb();
			}

			if (error.code !== 'DirectoryDoesNotExist') {
				return cb(error);
			}

			// mkdirp and retry

			if (retries === 0) {
				return cb(error);
			}

			var mkdirTarget = dirname(path);

			that.logger.warning('Folder', mkdirTarget, 'does not exist, calling mkdirp before retrying');

			that.client.mkdirp(mkdirTarget, function (error) {
				if (error) {
					return cb(error);
				}

				that.logger.debug('Folder', mkdirTarget, 'created');

				put(retries - 1);
			});
		});

		stream.end(obj.data);
	}

	put(1);
};


MantaVault.prototype.unlink = function (folder, file, cb) {
	var path = this.makePath(folder, file);

	this.logger.verbose('unlink:', path);

	this.client.unlink(path, cb);
};

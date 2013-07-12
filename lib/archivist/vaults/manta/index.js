// based on node-manta, this vault does not support sharding
//
// key format: string
//
// references:
// -----------
// node-manta: https://github.com/joyent/node-manta


var Archive = require('./Archive');
var MemoryStream = require('memorystream');


exports.defaultValueHandlers = require('./defaultValueHandlers');


// Vault wrapper around node-manta

function MantaVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-manta instance
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new MantaVault(name, logger);
};


MantaVault.prototype.setup = function (cfg, cb) {
	var manta = require('manta');

	// TODO: feed a bunyan shim into createClient so we can log by ourselves

	this.client = manta.createClient({
		sign: manta.privateKeySigner({
			key: cfg.sign.key,
			keyId: cfg.sign.keyId,
			user: cfg.user
		}),
		user: cfg.user,
		url: cfg.url
	});

	this.logger.debug('Manta vault "' + this.name + '" ready:', this.client.toString());

	cb();
};


MantaVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.close();
		this.client = null;
	}
};


MantaVault.prototype.list = function (path, cb) {
	cb();
};


MantaVault.prototype.get = function (path, cb) {
	this.logger.verbose('get:', path);

	this.client.get(path, function (error, stream, res) {
		if (error) {
			return cb(error);
		}

		var mediaType = res.headers['content-type'];
		var buffers = [];
		var len = 0;

		stream.on('error', function (error) {
			cb(error);
		});

		stream.on('data', function (chunk) {
			buffers.push(chunk);
			len += chunk.length;
		});

		stream.on('end', function () {
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


MantaVault.prototype.set = function (path, obj, cb) {
	this.logger.verbose('set:', path);

	var stream = new MemoryStream();

	var options = {
		type: obj.mediaType,
		size: obj.data.length
	};

	this.client.put(path, stream, options, cb);

	stream.end(obj.data);
};


MantaVault.prototype.del = function (path, cb) {
	this.logger.verbose('del:', path);

	this.client.unlink(path, cb);
};

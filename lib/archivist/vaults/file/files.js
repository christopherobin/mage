var fs = require('fs');


/**
 * Writes a file data with given write options.
 *
 * @param {String} filePath
 * @param {Object} options
 * @param {String} data
 * @param {Function} cb
 */
exports.writeWithOptions = function (filePath, options, data, cb) {
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
};
var mage = require('../../../mage');
var fs = require('fs');
var path = require('path');
var async = require('async');

exports.access = 'admin';

exports.params = [];

var CRAWL_MAX_PARALLEL = 10;

function Entry() {
	this.folders = {};
	this.files = [];
}


function find(result, parallelLimit, matcher, rootPath, cb) {
	var queue;

	function worker(file, callback) {
		if (file.name[0] === '.') {
			return callback();
		}

		var abs = path.join(rootPath, file.rel);

		fs.stat(abs, function (error, stats) {
			if (error) {
				// since we follow symlinks, and those may point into the void, we should ignore
				// ENOENT (file does not exist error).

				if (error.code === 'ENOENT') {
					return callback();
				}

				return callback(error);
			}

			if (stats.isDirectory()) {
				return fs.readdir(abs, function (error, files) {
					if (error) {
						return callback(error);
					}

					for (var i = 0; i < files.length; i++) {
						queue.push({
							name: files[i],
							rel: path.join(file.rel, files[i])
						});
					}

					return callback();
				});
			}

			if (stats.isFile() && file.name.match(matcher)) {
				var chunks = file.rel.split('/');
				var fileName = chunks.pop();
				var subresult = result;

				for (var i = 0; i < chunks.length; i++) {
					var chunk = chunks[i];

					if (!subresult.folders[chunk]) {
						subresult.folders[chunk] = new Entry();
					}

					subresult = subresult.folders[chunk];
				}

				subresult.files.push(fileName);
			}

			callback();
		});
	}

	if (parallelLimit < 1) {
		parallelLimit = 1;
	}

	queue = async.queue(worker, parallelLimit);
	queue.drain = cb;
	queue.push({ name: path.basename(rootPath), rel: '' });
}


exports.execute = function (state, cb) {
	var result = new Entry();

	find(result, CRAWL_MAX_PARALLEL, /\.md$/, mage.rootPackage.path, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		state.respond(result);

		cb();
	});
};

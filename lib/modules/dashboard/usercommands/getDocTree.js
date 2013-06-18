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


function find(result, parallelLimit, matcher, absPath, relPath, cb) {
	function analyzeFile(file, callback) {
		if (file[0] === '.') {
			return callback();
		}

		var fileAbsPath = path.join(absPath, file);
		var fileRelPath = path.join(relPath, file);

		fs.stat(fileAbsPath, function (error, stats) {
			if (error) {
				return callback(error);
			}

			if (stats.isDirectory()) {
				return find(result, 1, matcher, fileAbsPath, fileRelPath, callback);
			}

			if (stats.isFile() && file.match(matcher)) {
				var chunks = fileRelPath.split('/');
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

	fs.readdir(absPath, function (error, files) {
		if (error) {
			return cb(error);
		}

		async.forEachLimit(files, parallelLimit, analyzeFile, cb);
	});
}


exports.execute = function (state, cb) {
	var result = new Entry();

	find(result, CRAWL_MAX_PARALLEL, /\.md$/, mage.rootPackage.path, '', function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		state.respond(result);

		cb();
	});
};
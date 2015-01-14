var assert = require('assert');
var fs = require('fs');
var pathJoin = require('path').join;
var mkdirp = require('mkdirp');
var async = require('async');


function supportsGzip(req) {
	var accepts = req && req.headers['accept-encoding'];
	if (!accepts) {
		return false;
	}

	return accepts.split(/\s*,\s*/).indexOf('gzip') !== -1;
}


function Response(meta) {
	this.meta = meta || {};
	this.builds = {};

	if (this.meta.lastModified) {
		this.setLastModified(this.meta.lastModified);
	}

	if (this.meta.contentType) {
		this.setContentType(this.meta.contentType);
	}
}


module.exports = Response;


Response.prototype.getHash = function () {
	return this.meta.hash;
};


Response.prototype.isModifiedSince = function (date) {
	if (!date || !this.meta.lastModified) {
		return true;
	}

	if (!(date instanceof Date)) {
		date = new Date(date);
	}

	var testMDate = date.getTime();
	var realMDate = this.meta.lastModified.getTime();

	return isNaN(testMDate) || testMDate < realMDate;
};


Response.prototype.setLastModified = function (date) {
	if (typeof date === 'string' || typeof date === 'number') {
		date = new Date(date);
	}

	date.setUTCMilliseconds(0);

	this.meta.lastModified = date;
	this.setHeader('last-modified', date.toUTCString());
};


Response.prototype.setContentType = function (type) {
	this.meta.contentType = type;
	this.setHeader('content-type', type);
};


Response.prototype.setBaseBuild = function (data) {
	this._addBuild('base', data);
};


Response.prototype.setGzippedBuild = function (data) {
	this._addBuild('gzipped', data, { 'content-encoding': 'gzip' });
};


Response.prototype._addBuild = function (name, data, headers) {
	assert(name);
	assert(Buffer.isBuffer(data));

	headers = headers || {};
	headers['content-length'] = data.length;
	headers.pragma = 'no-cache';  // no browser caching for WebApp downloads

	if (this.meta.lastModified) {
		headers['last-modified'] = this.meta.lastModified.toUTCString();
	}

	if (this.meta.contentType) {
		headers['content-type'] = this.meta.contentType;
	}

	this.builds[name] = {
		headers: headers,
		data: data
	};
};


Response.prototype.getBestBuild = function (req) {
	if (req && this.builds.gzipped && supportsGzip(req)) {
		return this.builds.gzipped;
	}

	return this.builds.base;
};


Response.prototype.setHeader = function (name, value) {
	var buildNames = Object.keys(this.builds);
	for (var i = 0; i < buildNames.length; i += 1) {
		this.setBuildHeader(buildNames[i], name, value);
	}
};


Response.prototype.setBuildHeader = function (buildName, name, value) {
	this.builds[buildName].headers[name] = value;
};


Response.prototype.store = function (folder, cb) {
	var meta = this.meta;
	var builds = this.builds;
	var buildNames = Object.keys(builds);

	async.series([
		function createResponseFolder(callback) {
			mkdirp(folder, callback);
		},
		function writeMeta(callback) {
			fs.writeFile(pathJoin(folder, 'meta.json'), JSON.stringify(meta), callback);
		},
		function writeHeaders(callback) {
			async.eachSeries(
				buildNames,
				function (buildName, callback) {
					var buildFolder = pathJoin(folder, 'builds/' + buildName);
					var build = builds[buildName];

					async.series([
						function (callback) {
							mkdirp(buildFolder, callback);
						},
						function (callback) {
							fs.writeFile(pathJoin(buildFolder, 'headers.json'), JSON.stringify(build.headers), callback);
						},
						function (callback) {
							fs.writeFile(pathJoin(buildFolder, 'data.bin'), build.data, callback);
						}
					], callback);
				},
				callback
			);
		}
	], cb);
};


Response.load = function (folder, cb) {
	var response;

	async.series([
		function readMeta(callback) {
			fs.readFile(pathJoin(folder, 'meta.json'), { encoding: 'utf8' }, function (error, data) {
				if (error) {
					return callback(error);
				}

				response = new Response(JSON.parse(data));

				return callback();
			});
		},
		function listBuilds(callback) {
			fs.readdir(pathJoin(folder, 'builds'), function (error, buildNames) {
				if (error) {
					return callback(error);
				}

				async.eachSeries(
					buildNames,
					function loadBuild(buildName, callback) {
						var buildPath = pathJoin(folder, 'builds/' + buildName);

						fs.readFile(pathJoin(buildPath, 'headers.json'), function (error, headers) {
							if (error) {
								return callback(error);
							}

							headers = JSON.parse(headers);

							fs.readFile(pathJoin(buildPath, 'data.bin'), function (error, data) {
								if (error) {
									return callback(error);
								}

								response._addBuild(buildName, data, headers);

								callback();
							});
						});
					},
					callback
				);
			});
		}
	], function (error) {
		cb(error, response);
	});
};

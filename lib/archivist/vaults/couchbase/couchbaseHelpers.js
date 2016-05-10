var async = require('async');

var requirePeer = require('codependency').get('mage');
var couchbase = requirePeer('couchbase');


// Retry delay for all wait operations
var READY_RETRY_INTERVAL = 1000;


/**
 * Warm up Couchbase SET operations on new bucket
 *
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForSet(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for SET...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				if (error.code === 22) {
					return setTimeout(callback, READY_RETRY_INTERVAL);
				} else {
					return callback(error);
				}
			}

			bucket.upsert('mage/create/test_key', { mageTestKey: 394649 }, {}, function (error) {
				if (error) {
					if (error.code === 11 || error.code === 16 || error.code === 42) {
						return setTimeout(callback, READY_RETRY_INTERVAL);
					} else {
						return callback(error);
					}
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * Warm up Couchbase GET operations on new bucket
 *
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForGet(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for GET...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				if (error.code === 22) {
					return setTimeout(callback, READY_RETRY_INTERVAL);
				} else {
					return callback(error);
				}
			}

			bucket.get('mage/create/test_key', {}, function (error) {
				if (error) {
					if (error.code === 11 || error.code === 16 || error.code === 42) {
						return setTimeout(callback, READY_RETRY_INTERVAL);
					} else {
						return callback(error);
					}
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * Warm up Couchbase N1QL operations on new bucket
 *
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForN1QL(logger, cluster, bucketOptions, cb) {
	if (!bucketOptions.qhosts) {
		logger.debug('N1QL not configured for bucket:', bucketOptions.bucket);
		return cb();
	}

	async.series([
		function (callback) {
			logger.debug('Waiting for N1QL index...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						if (error.code === 22) {
							return setTimeout(callback, READY_RETRY_INTERVAL);
						} else {
							return callback(error);
						}
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Create primary index on bucket to test N1QL warm-up
					var query = 'CREATE PRIMARY INDEX ON `' + bucketOptions.bucket + '`';
					bucket.query(couchbase.N1qlQuery.fromString(query), function (error) {
						if (error) {
							return callback(error);
						}

						keepWaiting = false;
						return callback();
					});
				});
			}, callback);
		},
		function (callback) {
			logger.debug('Waiting for N1QL query...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						if (error.code === 22) {
							return setTimeout(callback, READY_RETRY_INTERVAL);
						} else {
							return callback(error);
						}
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Attempt to perform query on indexed data
					var query = 'SELECT mageTestKey FROM `' + bucketOptions.bucket + '` WHERE mageTestKey=394649';
					var n1qlQuery = couchbase.N1qlQuery.fromString(query);
					n1qlQuery.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);

					bucket.query(n1qlQuery, function (error, results) {
						if (error) {
							keepWaiting = false;
							keepWaiting = keepWaiting || /^An unknown error occured/.test(error.message);
							keepWaiting = keepWaiting || /^An unknown N1QL error occured/.test(error.message);

							if (keepWaiting) {
								return setTimeout(callback, READY_RETRY_INTERVAL);
							} else {
								return callback(error);
							}
						}

						if (!results.length) {
							return setTimeout(callback, READY_RETRY_INTERVAL);
						}

						keepWaiting = false;
						return callback();
					});
				});
			}, callback);
		},
		function (callback) {
			logger.debug('Waiting for N1QL drop index...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						if (error.code === 22) {
							return setTimeout(callback, READY_RETRY_INTERVAL);
						} else {
							return callback(error);
						}
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Drop previously created primary index
					var query = 'DROP PRIMARY INDEX ON `' + bucketOptions.bucket + '`';
					bucket.query(couchbase.N1qlQuery.fromString(query), function (error) {
						if (error) {
							return callback(error);
						}

						keepWaiting = false;
						return callback();
					});
				});
			}, callback);
		}
	], cb);
}


/**
 * Warm up Couchbase DELETE operations on new bucket
 *
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForDel(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for DEL...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				if (error.code === 22) {
					keepWaiting = true;
					return setTimeout(callback, READY_RETRY_INTERVAL);
				} else {
					return callback(error);
				}
			}

			bucket.remove('mage/create/test_key', {}, function (error) {
				if (error) {
					if (error.code === 11 || error.code === 16 || error.code === 42) {
						keepWaiting = true;
						return setTimeout(callback, READY_RETRY_INTERVAL);
					} else {
						return callback(error);
					}
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * Create Couchbase bucket.
 *
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Object} createBucketData
 * @param {Function} cb
 */
function createBucket(logger, cluster, bucketOptions, createBucketData, cb) {
	logger.notice('Creating bucket:', bucketOptions.bucket);

	var keepWaiting = true;
	var clusterManager = cluster.manager(createBucketData.adminUsername, createBucketData.adminPassword);

	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		clusterManager.createBucket(bucketOptions.bucket, createBucketData, function (error) {
			if (error) {
				if (error.code === 11 || error.code === 16 || error.code === 42) {
					keepWaiting = true;
					return setTimeout(callback, READY_RETRY_INTERVAL);
				} else {
					return callback(error);
				}
			}

			// This is necessary to be able to use the bucket right after a creation. Basically the bucket has
			// a small warm up time, during which connections and operations will fail. To make sure our
			// bucket is ready for use, we wait for it here.
			async.series([
				waitForSet.bind(null, logger, cluster, bucketOptions),
				waitForGet.bind(null, logger, cluster, bucketOptions),
				waitForN1QL.bind(null, logger, cluster, bucketOptions),
				waitForDel.bind(null, logger, cluster, bucketOptions)
			], function (error) {
				if (error) {
					if (error.code === 11 || error.code === 16 || error.code === 42) {
						return setTimeout(callback, READY_RETRY_INTERVAL);
					} else {
						return callback(error);
					}
				}

				logger.notice('Bucket ready for use:', bucketOptions.bucket);
				return callback();
			});
		});
	}, cb);
}


/**
 * Pass-through encoder for couchnode
 * See: https://github.com/couchbase/couchnode/pull/49
 *
 * NOTE: The code itself is mostly copy/pasted from within
 * the Native C code inside couchnode `src/transcoder.cc`
 *
 * @param {*} value
 * @returns {*}
 */
function encoder(value) {
	var transcoderDoc;
	if (typeof value === 'string' || value instanceof String) {
		transcoderDoc = { value: new Buffer(value), flags: 0 };
	} else if (value instanceof Buffer) {
		transcoderDoc = { value: value, flags: 4 };
	} else {
		if (value.value && value.flags) {
			if (typeof value.value === 'string' || value.value instanceof String) {
				transcoderDoc = { value: new Buffer(value.value), flags: value.flags };
			} else if (value.value instanceof Buffer) {
				transcoderDoc = { value: value.value, flags: value.flags };
			} else {
				transcoderDoc = { value: new Buffer(JSON.stringify(value.value)), flags: value.flags };
			}
		} else {
			try {
				transcoderDoc = { value: new Buffer(JSON.stringify(value)), flags: 2 };
			} catch (error) {
				// TODO: NEED BETTER ERROR HANDLING HERE
				return;
			}
		}
	}

	return transcoderDoc;
}


/**
 * Pass-through decoder for couchnode
 * See: https://github.com/couchbase/couchnode/pull/49
 *
 * @param {*} transcoderDoc
 * @returns {*}
 */
function decoder(transcoderDoc) {
	return transcoderDoc;
}


// Make wait functions public
exports.waitForSet = waitForSet;
exports.waitForGet = waitForGet;
exports.waitForN1QL = waitForN1QL;
exports.waitForDel = waitForDel;
exports.createBucket = createBucket;

// Make transcoder functions public
exports.encoder = encoder;
exports.decoder = decoder;
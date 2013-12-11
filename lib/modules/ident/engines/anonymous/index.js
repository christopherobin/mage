var uuid = require('node-uuid');
var util = require('util');
var Engine = require('../engine').Engine;


function Anonymous(cfg, logger) {
	this.cfg = cfg;
	this.logger = logger;
}

util.inherits(Anonymous, Engine);


Anonymous.prototype.auth = function (state, credentials, cb) {
	var userId = uuid.v4();
	var userInfo = {
		username: 'anonymous'
	};

	cb(null, userId, userInfo);
};

/**
 *
 * @param cfg
 * @param logger
 * @param cb
 */
exports.setup = function (cfg, logger, cb) {
	var instance = new Anonymous(cfg, logger);

	cb(null, instance);
};

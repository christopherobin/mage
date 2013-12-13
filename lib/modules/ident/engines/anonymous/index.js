var uuid = require('node-uuid');
var util = require('util');
var Engine = require('../engine').Engine;


function Anonymous(logger) {
	this.logger = logger;
}

util.inherits(Anonymous, Engine);


Anonymous.prototype.auth = function (state, credentials, cb) {
	var userId = uuid.v4();

	var user = {
		userId: userId,
		displayName: 'Anonymous ' + userId.substr(0, 6)
	};

	cb(null, user);
};


exports.setup = function (name, cfg, logger, cb) {
	cb(null, new Anonymous(logger));
};

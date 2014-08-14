var requirePeer = require('codependency').get('mage');

var zmq = requirePeer('zmq');


module.exports = function (identity) {
	var dealer = zmq.createSocket('dealer');

	if (identity) {
		dealer.identity = identity;
	}

	return dealer;
};
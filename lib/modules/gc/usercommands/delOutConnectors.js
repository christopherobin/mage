var mage = require('../../../mage');

exports.execute = function (state, p, cb) {
	if (!(p instanceof Array)) {
		p = [].concat(p);
	}

	mage.gc.delOutConnectors(state, p, cb);
};

